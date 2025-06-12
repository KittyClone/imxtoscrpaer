// Lightbox.jsx
import React, { useEffect } from 'react';

const Lightbox = ({ image, onClose, onNavigate, currentIndex, totalImages }) => {
  // Effect for keyboard navigation (left/right arrows, escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        onNavigate('prev');
      } else if (e.key === 'ArrowRight') {
        onNavigate('next');
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown); // Cleanup
  }, [onNavigate, onClose]); // Dependencies

  if (!image) return null; // Don't render if no image is provided

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.85)', // Darker overlay
      display: 'flex',
      flexDirection: 'column', // For better alignment of components
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(5px)', // Optional: Blur background
      WebkitBackdropFilter: 'blur(5px)' // For Safari
    }} onClick={onClose}> {/* Click outside to close */}
      <button onClick={onClose} style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        backgroundColor: 'white',
        color: 'black',
        border: 'none',
        borderRadius: '50%',
        width: '45px',
        height: '45px',
        fontSize: '24px',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
      }}>✖</button>

      <button onClick={(e) => { e.stopPropagation(); onNavigate('prev'); }} style={{ // Prevent closing when clicking nav buttons
        position: 'absolute',
        left: '20px',
        backgroundColor: 'white',
        color: 'black',
        border: 'none',
        borderRadius: '50%',
        width: '45px',
        height: '45px',
        fontSize: '30px',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
      }}>{"<"}</button>

      <img
        src={image}
        alt={`Full view ${currentIndex + 1}`}
        style={{
          maxWidth: '90%',
          maxHeight: '80%', // Give some space for controls
          objectFit: 'contain',
          borderRadius: '8px',
          boxShadow: '0 5px 15px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
      />

      <button onClick={(e) => { e.stopPropagation(); onNavigate('next'); }} style={{ // Prevent closing when clicking nav buttons
        position: 'absolute',
        right: '20px',
        backgroundColor: 'white',
        color: 'black',
        border: 'none',
        borderRadius: '50%',
        width: '45px',
        height: '45px',
        fontSize: '30px',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
      }}>{">"}</button>

      <div style={{ position: 'absolute', bottom: '20px', color: 'white', fontSize: '18px', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
        {currentIndex + 1} / {totalImages}
      </div>
    </div>
  );
};

export default Lightbox;