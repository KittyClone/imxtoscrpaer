import { useState } from 'react';
import axios from 'axios';

// API_BASE_URL is now used only by the Vite proxy, not directly in axios.get
// It's still good to define it for reference and to ensure the proxy config uses it.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  console.error('VITE_API_BASE_URL is not defined! Please check your .env file or environment setup.');
  alert('Configuration error: API Base URL not set. Check console.');
}

function App() {
  const [url, setUrl] = useState('');
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchImages = async () => {
    setLoading(true);
    setError('');
    setImages([]);

    try {
      // *** CHANGE THIS LINE ***
      // axios will now make a request to /api/images from the frontend's origin
      // Vite will then proxy it to your backend's VITE_API_BASE_URL/images
      const res = await axios.get('/api/images', {
        params: { gallery_url: url }
      });
      if (res.data.image_urls?.length) {
        setImages(res.data.image_urls);
      } else {
        setError('No images found for this gallery, or the gallery is empty.');
      }
    } catch (err) {
      console.error("Fetch Images Error:", err);
      setError(
        err?.response?.data?.detail ||
        err?.message ||
        'An unexpected error occurred. Is the backend running and accessible?'
      );
    } finally {
      setLoading(false);
    }
  };

  const downloadZip = () => {
    // *** CHANGE THIS LINE TOO ***
    const zipUrl = `/api/zip?gallery_url=${encodeURIComponent(url)}`;
    window.open(zipUrl, '_blank');
  };

  const reset = () => {
    setUrl('');
    setImages([]);
    setError('');
  };

  return (
    <div style={{ padding: 20, fontFamily: 'Arial' }}>
      <h1>🖼️ IMX Gallery Downloader</h1>
      <input
        type="text"
        placeholder="Enter IMX.to gallery URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        style={{ width: '80%', padding: 10, fontSize: 16 }}
      />
      <br />
      <div style={{ marginTop: 10 }}>
        <button onClick={fetchImages} disabled={!url || loading} style={{ padding: '10px 20px' }}>
          {loading ? '🔄 Fetching...' : 'Fetch Images'}
        </button>
        <button onClick={reset} style={{ marginLeft: 10, padding: '10px 20px' }}>
          Reset
        </button>
      </div>

      {images.length > 0 && (
        <>
          <div style={{ marginTop: 20 }}>
            <button
              onClick={downloadZip}
              disabled={loading}
              style={{ padding: '10px 20px' }}
            >
              📦 Download ZIP ({images.length} files)
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, 150px)',
              gap: 10,
              marginTop: 20
            }}
          >
            {images.map((img, idx) => (
              <div key={idx} style={{ textAlign: 'center' }}>
                <img
                  src={img}
                  alt={`img-${idx}`}
                  style={{ width: '100%', borderRadius: 4 }}
                />
                <button
                  onClick={() => navigator.clipboard.writeText(img)}
                  style={{
                    marginTop: 5,
                    fontSize: 12,
                    padding: '4px 8px',
                    cursor: 'pointer'
                  }}
                >
                  Copy URL
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {error && <p style={{ color: 'red', marginTop: 20 }}>{error}</p>}
    </div>
  );
}

export default App;