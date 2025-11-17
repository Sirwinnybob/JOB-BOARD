import React, { useRef, useState, useEffect } from 'react';

function SlideShowView({ pdfs, initialIndex = 0, onClose = null, enteredViaClick = false }) {
  const scrollContainerRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isScrolling, setIsScrolling] = useState(false);
  const [showAnimation, setShowAnimation] = useState(enteredViaClick);
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage first, then fall back to system preference
    const saved = localStorage.getItem('slideShowDarkMode');
    if (saved !== null) {
      return saved === 'true';
    }
    // Default to system preference
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Filter out placeholders for slideshow
  const displayPdfs = pdfs.filter(pdf => pdf && !pdf.is_placeholder);

  // Save dark mode preference to localStorage
  useEffect(() => {
    localStorage.setItem('slideShowDarkMode', darkMode.toString());
  }, [darkMode]);

  // Turn off animation after it completes
  useEffect(() => {
    if (showAnimation) {
      const timer = setTimeout(() => {
        setShowAnimation(false);
      }, 500); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, [showAnimation]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setIsScrolling(true);
      const scrollLeft = container.scrollLeft;
      const itemWidth = container.offsetWidth;
      const index = Math.round(scrollLeft / itemWidth);
      setCurrentIndex(index);

      // Clear the scrolling state after a delay
      const timeout = setTimeout(() => {
        setIsScrolling(false);
      }, 150);

      return () => clearTimeout(timeout);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToIndex = (index) => {
    const container = scrollContainerRef.current;
    if (container) {
      const itemWidth = container.offsetWidth;
      container.scrollTo({
        left: index * itemWidth,
        behavior: 'smooth'
      });
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      scrollToIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < displayPdfs.length - 1) {
      scrollToIndex(currentIndex + 1);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, displayPdfs.length, onClose]);

  // Scroll to initial index when component mounts
  useEffect(() => {
    if (initialIndex >= 0 && initialIndex < displayPdfs.length) {
      scrollToIndex(initialIndex);
    }
  }, []);

  // Prevent body scroll when in fullscreen mode
  useEffect(() => {
    if (onClose) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [onClose]);

  if (displayPdfs.length === 0) {
    if (onClose) {
      return (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xl text-white mb-4">No jobs to display</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-xl text-gray-600 dark:text-gray-400 transition-colors">
          No jobs to display
        </p>
      </div>
    );
  }

  // Fullscreen mode styling
  const containerClass = onClose
    ? "fixed inset-0 bg-black z-50"
    : "relative w-full";
  const containerStyle = onClose
    ? { height: '100vh' }
    : { height: 'calc(100vh - 180px)' };

  return (
    <>
      <style>
        {`
          @keyframes zoomIn {
            from {
              opacity: 0;
              transform: scale(0.5);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
          .zoom-animation {
            animation: zoomIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          }
        `}
      </style>
      <div className={`${containerClass} ${showAnimation ? 'zoom-animation' : ''}`} style={containerStyle}>
        {/* Horizontal Scroll Container */}
        <div
          ref={scrollContainerRef}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide h-full"
          style={{
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
        {displayPdfs.map((pdf, index) => {
          // Determine which image to show based on dark mode
          const isDarkMode = darkMode || (document.documentElement.classList.contains('dark') && !darkMode);
          const imagesBase = (isDarkMode && pdf.dark_mode_images_base) ? pdf.dark_mode_images_base : pdf.images_base;
          const imageSrc = imagesBase ? `/thumbnails/${imagesBase}-1.png` : `/thumbnails/${pdf.thumbnail}`;

          return (
            <div
              key={pdf.id}
              className="flex-shrink-0 w-full h-full snap-center flex items-center justify-center p-4"
            >
              <div
                className="relative h-full max-w-6xl w-full mx-auto flex items-center justify-center"
              >
                <img
                  src={imageSrc}
                  alt={pdf.original_name}
                  className="max-w-full max-h-full object-contain transition-all"
                  loading="lazy"
                  onError={(e) => {
                    // Fallback to regular image if dark mode image fails
                    if (isDarkMode && pdf.dark_mode_images_base && e.target.src.includes('-dark-')) {
                      e.target.src = `/thumbnails/${pdf.images_base}-1.png`;
                    }
                  }}
                />

                {/* Job Info Overlay */}
                <div className="absolute top-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg">
                  <div className="text-sm font-medium">
                    {pdf.job_number && <div>Job #{pdf.job_number}</div>}
                    {pdf.construction_method && (
                      <div className="text-xs text-gray-300">{pdf.construction_method}</div>
                    )}
                  </div>
                </div>

                {/* Labels */}
                {pdf.labels && pdf.labels.length > 0 && (
                  <div className="absolute top-4 right-4 flex flex-wrap gap-2 justify-end">
                    {pdf.labels.map((label) => (
                      <span
                        key={label.id}
                        className="px-3 py-1 text-sm font-bold text-white rounded-lg shadow-lg"
                        style={{ backgroundColor: label.color }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Arrows */}
      {displayPdfs.length > 1 && (
        <>
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-4 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed z-10"
            aria-label="Previous"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={handleNext}
            disabled={currentIndex === displayPdfs.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-4 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed z-10"
            aria-label="Next"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Position Indicator */}
      {displayPdfs.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 px-4 py-2 rounded-full z-10">
          {displayPdfs.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollToIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-white w-8'
                  : 'bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Counter and Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        {onClose && (
          <>
            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="bg-black/70 hover:bg-black/90 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="bg-black/70 hover:bg-black/90 text-white p-2 rounded-lg transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        )}

        {/* Counter */}
        <div className="bg-black/70 text-white px-4 py-2 rounded-lg text-sm font-medium">
          {currentIndex + 1} / {displayPdfs.length}
        </div>
      </div>
    </div>
    </>
  );
}

export default SlideShowView;
