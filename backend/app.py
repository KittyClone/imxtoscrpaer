from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import httpx
from selectolax.parser import HTMLParser # You might be using selectolax instead of BS4, but the error points to BS4
from bs4 import BeautifulSoup # <--- ADD THIS LINE!
import asyncio
import uuid
from urllib.parse import urljoin # <--- ADD THIS LINE!
import logging
from zipfile import ZipFile
import zipfile
import os
from starlette.responses import StreamingResponse # <--- ADD THIS LINE!

import io , requests , time , random 
# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = FastAPI(
    title="IMX.to Gallery Downloader",
    description="API to scrape and download images from IMX.to galleries.",
    version="1.0.0"
)

# --- CORS Configuration ---
origins = [
    "http://localhost",
    "http://localhost:8000", # If you run frontend on 8000 sometimes
    "http://localhost:5173", # Common Vite dev server port
    "http://localhost:5174", # Your current frontend port, if local
    "https://shiny-space-cod-r4xpqxvqpxx5c99q-5174.app.github.dev", # <--- Add your specific frontend URL here
    "https://shiny-space-cod-r4xpqxvqpxx5c99q-8001.app.github.dev", # Your backend URL if running locally too (though unlikely)
    "*" # <--- The wildcard should technically cover it, but explicit origins are safer
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # <--- Use the origins list
    allow_credentials=True,
    allow_methods=["*"], # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"], # Allows all headers
)
# --- END CORS Configuration ---

# Your existing HEADERS and progress dictionary
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://imx.to/',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-User': '?1'
}

progress = {} # In-memory progress tracker (UUID-based)

def get_viewer_links(gallery_url: str, session: requests.Session) -> list:
    """Fetches viewer links from a gallery URL."""
    logging.info(f"🔍 Fetching gallery page: {gallery_url}")
    try:
        res = session.get(gallery_url, headers=HEADERS, timeout=10)
        res.raise_for_status()
        soup = BeautifulSoup(res.text, 'html.parser')

        viewer_links = []
        # Priority 1: Links within elements with class 'tooltip'
        a_tags_tooltip = soup.select('.tooltip a[href]')
        for a in a_tags_tooltip:
            href = a['href']
            if href.startswith('https://imx.to/i/'):
                viewer_links.append(href)

        # Priority 2: Direct links to imx.to/i/ or relative /i/
        if not viewer_links:
            a_tags_direct = soup.select('a[href^="https://imx.to/i/"], a[href^="/i/"]')
            for a in a_tags_direct:
                href = a['href']
                # Ensure the link is not just the base domain
                if href.strip() != '/i/':
                    viewer_links.append(urljoin(gallery_url, href))
        
        logging.info(f"Found {len(viewer_links)} viewer links for {gallery_url}")
        return list(set(viewer_links)) # Remove duplicates

    except requests.exceptions.RequestException as e:
        logging.error(f"Request failed for gallery {gallery_url}: {e}")
        return []
    except Exception as e:
        logging.error(f"Error parsing gallery page {gallery_url}: {e}")
        return []

def get_image_url(viewer_url: str, session: requests.Session) -> str | None:
    """Extracts the direct image URL from a viewer page."""
    logging.info(f"✨ Extracting image from viewer page: {viewer_url}")
    try:
        res = session.get(viewer_url, headers=HEADERS, timeout=10)
        res.raise_for_status()
        soup = BeautifulSoup(res.text, 'html.parser')

        # Handle potential POST form submission
        form = soup.find("form", {"method": "POST"})
        if form:
            post_url = urljoin(viewer_url, form.get("action", ""))
            form_data = {
                input_tag.get("name"): input_tag.get("value", "")
                for input_tag in form.find_all("input")
                if input_tag.get("name")
            }
            logging.info(f"Submitting POST request to {post_url} for {viewer_url}")
            res = session.post(post_url, data=form_data, headers=HEADERS, timeout=10)
            res.raise_for_status()
            soup = BeautifulSoup(res.text, 'html.parser')

        # Find image tag
        img_tag = soup.find("img", {"class": "centred"}) or soup.find("img", {"id": "image"})
        if not img_tag:
            # Broader search for common image attributes
            for img in soup.find_all("img"):
                if ("max-width" in img.get("style", "")) or ("centred" in img.get("class", [])) or \
                   ("src" in img.attrs and "imx.to/i/" not in img.get("src")): # Exclude viewer links if present
                    img_tag = img
                    break

        if img_tag and img_tag.get("src"):
            full_img_url = urljoin(viewer_url, img_tag["src"])
            logging.info(f"Found image URL: {full_img_url}")
            return full_img_url
        else:
            logging.warning(f"No direct image tag found on {viewer_url}")
            return None

    except requests.exceptions.RequestException as e:
        logging.error(f"Request failed for viewer {viewer_url}: {e}")
        return None
    except Exception as e:
        logging.error(f"Error parsing viewer page {viewer_url}: {e}")
        return None



### Endpoints

#### Fetch Images
@app.get("/images", summary="Fetches image URLs from an IMX.to gallery")
async def fetch_images(
    gallery_url: str = Query(..., description="The URL of the IMX.to gallery to scrape")
):
    """
    Initiates the scraping process to find all image URLs within a specified gallery.
    Returns a job ID, the total count of image URLs found, and the list of image URLs.
    """
    try:
        session = requests.Session()
        session.headers.update(HEADERS)
        viewer_links = get_viewer_links(gallery_url, session)

        if not viewer_links:
            logging.warning(f"No viewer links found for gallery: {gallery_url}")
            raise HTTPException(status_code=404, detail="No images found from the provided gallery URL.")

        image_urls = []
        job_id = str(uuid.uuid4())
        progress[job_id] = {"total": len(viewer_links), "completed": 0, "status": "processing", "image_urls": []}

        for i, viewer_url in enumerate(viewer_links):
            img_url = get_image_url(viewer_url, session)
            if img_url:
                image_urls.append(img_url)
                progress[job_id]["image_urls"].append(img_url) # Store image URLs in progress
            progress[job_id]["completed"] = i + 1
            # Introduce a short, random delay to avoid aggressive scraping
            time.sleep(random.uniform(0.5, 1.2))

        progress[job_id]["status"] = "completed"
        logging.info(f"Job {job_id} completed. Found {len(image_urls)} images.")
        return {
            "job_id": job_id,
            "count": len(image_urls),
            "image_urls": image_urls
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.exception(f"Internal server error during image fetching for {gallery_url}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


#### Get Progress
@app.get("/progress/{job_id}", summary="Checks the progress of an image fetching job")
async def get_progress(job_id: str, # Changed from Query(...) to path parameter
                       # For documentation, you can still add description here if needed
                       # description="The unique ID of the scraping job"
                      ):
    """
    Retrieves the current progress of a previously initiated image scraping job.
    Includes details on total, completed, status, and fetched image URLs.
    """
    if job_id not in progress:
        logging.warning(f"Progress job {job_id} not found.")
        raise HTTPException(status_code=404, detail="Job not found. It might have expired or never existed.")

    # Return a copy to prevent accidental modification of the stored state
    return progress[job_id].copy()



#### Download Images as Zip

@app.get("/zip", summary="Downloads images from a gallery URL as a ZIP archive")
async def download_zip(
    gallery_url: str = Query(..., description="The URL of the image gallery to download"),
    job_id: str = Query(None, description="Optional: Use a job_id from a previous /images request to avoid re-scraping.")
):
    """
    Downloads all images from a specified gallery URL and returns them as a ZIP file.
    If a job_id is provided, it will attempt to use the image URLs already fetched
    by that job, avoiding redundant scraping.
    """
    image_urls = []
    session = requests.Session()
    session.headers.update(HEADERS)

    if job_id and job_id in progress and progress[job_id]["status"] == "completed":
        logging.info(f"Using cached image URLs from job {job_id}")
        image_urls = progress[job_id].get("image_urls", [])
        if not image_urls:
            logging.warning(f"Cached job {job_id} has no image URLs. Re-scraping.")
            # Fallback to scraping if cached job has no URLs
            viewer_links = get_viewer_links(gallery_url, session)
            if not viewer_links:
                raise HTTPException(status_code=404, detail="No images found to download (even after re-scraping).")
            
            for link in viewer_links:
                img_url = get_image_url(link, session)
                if img_url:
                    image_urls.append(img_url)
                time.sleep(random.uniform(0.5, 1.2))
    else:
        logging.info(f"No valid job_id provided or job not completed. Scraping gallery {gallery_url} for zipping.")
        viewer_links = get_viewer_links(gallery_url, session)
        if not viewer_links:
            logging.warning(f"No viewer links found for gallery: {gallery_url} during zip download.")
            raise HTTPException(status_code=404, detail="No images found to download.")
        
        for link in viewer_links:
            img_url = get_image_url(link, session)
            if img_url:
                image_urls.append(img_url)
            time.sleep(random.uniform(0.5, 1.2))

    if not image_urls:
        logging.warning(f"No image URLs compiled for gallery: {gallery_url} to create zip.")
        raise HTTPException(status_code=404, detail="No images to download.")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for idx, img_url in enumerate(image_urls):
            try:
                logging.info(f"Downloading image {idx+1}: {img_url}")
                img_res = session.get(img_url, timeout=15)
                img_res.raise_for_status()
                zip_file.writestr(f"image_{idx+1}.jpg", img_res.content)
            except requests.exceptions.RequestException as e:
                logging.error(f"Failed to download image {img_url}: {e}")
                # Continue to next image instead of failing the whole zip
                continue
            except Exception as e:
                logging.error(f"Unexpected error writing image {img_url} to zip: {e}")
                continue
    zip_buffer.seek(0)

    logging.info(f"Successfully created zip file for {len(image_urls)} images from {gallery_url}")
    
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=gallery_images.zip"}
    )