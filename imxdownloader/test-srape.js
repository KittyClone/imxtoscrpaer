const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  const galleryUrl = 'https://imx.to/g/1g56c';

  try {
    await page.goto(galleryUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 3000)); // Optional wait

    const imagePageUrls = await page.$$eval('a[href*="/i/"]', links =>
      [...new Set(links.map(link => link.href))]
    );

    console.log(`🔍 Found ${imagePageUrls.length} image pages.`);

    const downloadFolder = './downloads-full';
    fs.mkdirSync(downloadFolder, { recursive: true });

    for (let i = 0; i < Math.min(5, imagePageUrls.length); i++) {
      const imgPageUrl = imagePageUrls[i];
      const imgPage = await browser.newPage();

      try {
        console.log(`🌐 Visiting: ${imgPageUrl}`);
        await imgPage.goto(imgPageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // --- CONTINUE BUTTON LOGIC ---
        try {
          await imgPage.waitForSelector(
            'form[action][method="POST"], input#continuebutton[type="submit"]',
            { timeout: 5000 }
          );

          const hasInput = await imgPage.$('input#continuebutton[type="submit"]');
          const hasForm = await imgPage.$('form[action][method="POST"]');

          if (hasInput) {
            console.log('🟢 Clicking input#continuebutton...');
            await Promise.all([
              imgPage.click('input#continuebutton'),
              imgPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
            ]);
          } else if (hasForm) {
            console.log('🟡 Clicking form submit button...');
            await imgPage.evaluate(() => {
              const form = document.querySelector('form[action][method="POST"]');
              const submitBtn = form?.querySelector('[type="submit"]');
              if (submitBtn) submitBtn.click();
            });

            await Promise.race([
              imgPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
              imgPage.waitForSelector('a[href$=".jpg"], img[src$=".jpg"]', { timeout: 10000 }),
            ]);
          }
        } catch (e) {
          console.log('⚠️ No continue page or skipped:', e.message);
        }

        // --- EXTRACT IMAGE HREF ---
        let imageHref = await imgPage.evaluate(() => {
          const link = document.querySelector('a[href$=".jpg"]');
          return link ? link.href : null;
        });

        if (!imageHref) {
          // Try fallback: look for <img> with src
          imageHref = await imgPage.evaluate(() => {
            const img = document.querySelector('img[src$=".jpg"]');
            return img ? img.src : null;
          });
        }

        if (!imageHref) {
          throw new Error('No .jpg link or image found on final page.');
        }

        // --- DOWNLOAD IMAGE ---
        const filename = `full_image_${i + 1}.jpg`;
        const filepath = path.join(downloadFolder, filename);
        const writer = fs.createWriteStream(filepath);

        const response = await axios.get(imageHref, { responseType: 'stream' });
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        console.log(`✅ Downloaded: ${filepath}`);
      } catch (err) {
        console.error(`❌ Error for ${imgPageUrl}: ${err.message}`);
        // Optional: Take a screenshot for debugging
        await imgPage.screenshot({ path: `error_page_${i + 1}.png` });
      } finally {
        await imgPage.close();
      }
    }
  } catch (err) {
    console.error('🔥 Fatal error:', err.message);
  } finally {
    await browser.close();
  }
})();
