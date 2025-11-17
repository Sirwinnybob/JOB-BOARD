import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';

function SlideShowView({ pdfs, initialIndex = 0, onClose = null, enteredViaClick = false, isClosing = false, onAnimationComplete = null, originRect = null, onIndexChange = null, aspectWidth = 11, aspectHeight = 10 }) {
  const scrollContainerRef = useRef(null);
  const containerRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isScrolling, setIsScrolling] = useState(false);
  const [animationState, setAnimationState] = useState('zoom-in');
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [animationTransform, setAnimationTransform] = useState(null);

  // pdfs are already filtered (no nulls/undefined) from parent component
  const displayPdfs = pdfs;

  // Calculate animation transform from origin rect
  const calculateTransform = useCallback(() => {
    if (!originRect) {
      // No origin rect - use simple center zoom (fallback for toggle button)
      setAnimationTransform(null);
      return;
    }

    // Edge case: Validate originRect has required properties
    if (!originRect.width || !originRect.height || originRect.width <= 0 || originRect.height <= 0) {
      console.warn('[SlideShowView] Invalid originRect dimensions, using fallback animation');
      setAnimationTransform(null);
      return;
    }

    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Edge case: Very small viewports (mobile in landscape, etc.)
    if (viewportWidth < 200 || viewportHeight < 200) {
      console.warn('[SlideShowView] Viewport too small, using fallback animation');
      setAnimationTransform(null);
      return;
    }

    // Calculate scale needed: grid item size relative to viewport
    // This is how much we need to SHRINK the fullscreen view to match the grid item
    const scaleX = originRect.width / viewportWidth;
    const scaleY = originRect.height / viewportHeight;

    // Use the smaller scale to maintain aspect ratio
    // Edge case: Clamp scale to reasonable bounds (0.01 to 1)
    const scale = Math.max(0.01, Math.min(1, Math.min(scaleX, scaleY)));

    // Calculate the center of the clicked element
    const originCenterX = originRect.left + (originRect.width / 2);
    const originCenterY = originRect.top + (originRect.height / 2);

    // Calculate the center of the viewport
    const viewportCenterX = viewportWidth / 2;
    const viewportCenterY = viewportHeight / 2;

    // Calculate translation needed to move viewport center TO grid item center
    // (This positions the fullscreen container to appear at the grid item location)
    const translateX = originCenterX - viewportCenterX;
    const translateY = originCenterY - viewportCenterY;

    // Edge case: Clamp translations to prevent extreme off-screen animations
    const maxTranslate = Math.max(viewportWidth, viewportHeight) * 2;
    const clampedTranslateX = Math.max(-maxTranslate, Math.min(maxTranslate, translateX));
    const clampedTranslateY = Math.max(-maxTranslate, Math.min(maxTranslate, translateY));

    setAnimationTransform({
      scale,
      translateX: clampedTranslateX,
      translateY: clampedTranslateY,
      originX: originCenterX,
      originY: originCenterY,
    });

    console.log('[SlideShowView] Calculated animation transform:', {
      scale,
      translateX: clampedTranslateX,
      translateY: clampedTranslateY,
      originRect,
      viewport: { width: viewportWidth, height: viewportHeight },
    });
  }, [originRect]);

  useLayoutEffect(() => {
    calculateTransform();
  }, [calculateTransform]);

  // Edge case: Handle window resize during slideshow
  useEffect(() => {
    // Only recalculate if we're still in zoom-in state (animation in progress)
    // Don't recalculate during zoom-out as it would mess up the return animation
    const handleResize = () => {
      if (animationState === 'zoom-in' && originRect) {
        console.log('[SlideShowView] Window resized during animation, recalculating transform');
        calculateTransform();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [animationState, originRect, calculateTransform]);

  // Turn off zoom-in animation after it completes
  useEffect(() => {
    if (animationState === 'zoom-in') {
      console.log('[SlideShowView] Starting zoom-in animation');
      const timer = setTimeout(() => {
        console.log('[SlideShowView] Zoom-in animation completed, setting to none');
        setAnimationState('none');
      }, 400); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, []);

  // Handle zoom-out animation when closing
  useEffect(() => {
    if (isClosing) {
      console.log('[SlideShowView] isClosing=true, starting zoom-out animation');
      setAnimationState('zoom-out');
      const timer = setTimeout(() => {
        console.log('[SlideShowView] Zoom-out animation completed, calling onAnimationComplete');
        if (onAnimationComplete) {
          onAnimationComplete();
        }
      }, 400); // Match animation duration
      return () => {
        console.log('[SlideShowView] Cleaning up zoom-out timer');
        clearTimeout(timer);
      };
    }
  }, [isClosing, onAnimationComplete]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setIsScrolling(true);
      const scrollLeft = container.scrollLeft;
      // Each slide is w-[85%] of container, so use 85% for calculation
      const slideWidth = container.offsetWidth * 0.85;
      const index = Math.round(scrollLeft / slideWidth);
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

  // Report current index to parent
  useEffect(() => {
    if (onIndexChange) {
      onIndexChange(currentIndex);
    }
  }, [currentIndex, onIndexChange]);

  const scrollToIndex = (index, immediate = false) => {
    const container = scrollContainerRef.current;
    if (container) {
      // Each slide is w-[85%] of container, so use 85% for calculation
      const slideWidth = container.offsetWidth * 0.85;
      container.scrollTo({
        left: index * slideWidth,
        behavior: immediate ? 'auto' : 'smooth'
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

  // Scroll to initial index when component mounts (useLayoutEffect runs before paint)
  useLayoutEffect(() => {
    console.log('[SlideShowView] Initial scroll DEBUG:');
    console.log('  - initialIndex:', initialIndex);
    console.log('  - displayPdfs.length:', displayPdfs.length);
    console.log('  - displayPdfs:', displayPdfs.map(p => ({ id: p.id, is_placeholder: p.is_placeholder })));

    const container = scrollContainerRef.current;
    if (container && initialIndex >= 0 && initialIndex < displayPdfs.length) {
      // Each slide is w-[85%] of container, so use 85% for calculation
      const slideWidth = container.offsetWidth * 0.85;
      const scrollPosition = initialIndex * slideWidth;
      console.log('  - container.offsetWidth:', container.offsetWidth);
      console.log('  - slideWidth (85%):', slideWidth);
      console.log('  - Calculated scroll position:', scrollPosition);
      container.scrollLeft = scrollPosition;
      console.log('  - Actual scrollLeft after setting:', container.scrollLeft);

      // Set currentIndex immediately to match initialIndex
      setCurrentIndex(initialIndex);
    }
  }, []);

  // Prevent body scroll when in fullscreen mode (always in slideshow)
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (displayPdfs.length === 0) {
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

  // Always use fullscreen styling but start below header
  const containerClass = "fixed left-0 right-0 bottom-0 top-16 bg-white dark:bg-black z-50 transition-colors";
  const containerStyle = {};

  // Generate dynamic CSS animations based on originRect
  const generateAnimationCSS = () => {
    if (!animationTransform) {
      // Fallback to simple center zoom if no transform calculated
      return `
        @keyframes zoomIn {
          from {
            opacity: 0;
            transform: scale(0.85);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes zoomOut {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(0.85);
          }
        }
      `;
    }

    const { scale, translateX, translateY } = animationTransform;

    // Initial state: positioned at grid item location, scaled to grid item size
    // Final state: centered (translate 0,0), fullscreen (scale 1)
    return `
      @keyframes zoomIn {
        from {
          opacity: 0.3;
          transform: translate(${translateX}px, ${translateY}px) scale(${scale});
        }
        to {
          opacity: 1;
          transform: translate(0, 0) scale(1);
        }
      }
      @keyframes zoomOut {
        from {
          opacity: 1;
          transform: translate(0, 0) scale(1);
        }
        to {
          opacity: 0;
          transform: translate(${translateX}px, ${translateY}px) scale(${scale});
        }
      }
    `;
  };

  return (
    <>
      <style>
        {generateAnimationCSS()}
        {`
          .zoom-in-animation {
            animation: zoomIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .zoom-out-animation {
            animation: zoomOut 0.4s cubic-bezier(0.7, 0, 0.84, 0);
          }
        `}
      </style>
      <div
        ref={containerRef}
        className={`${containerClass} ${animationState === 'zoom-in' ? 'zoom-in-animation' : ''} ${animationState === 'zoom-out' ? 'zoom-out-animation' : ''}`}
        style={containerStyle}
      >
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
              className="flex-shrink-0 w-[85%] h-full snap-center flex items-center justify-center p-4"
            >
              <div
                className="relative h-full max-w-6xl w-full mx-auto flex items-center justify-center"
              >
                {pdf.is_placeholder ? (
                  <div className="max-w-full max-h-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-lg shadow-md border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center p-4 sm:p-6 md:p-8 transition-colors" style={{ aspectRatio: `${aspectWidth} / ${aspectHeight}` }}>
                    <p className="text-gray-600 dark:text-gray-400 text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-center break-words leading-tight transition-colors">
                      {pdf.placeholder_text || 'PLACEHOLDER'}
                    </p>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <img
                      src={imageSrc}
                      alt={pdf.original_name}
                      className="max-w-full max-h-full object-contain rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 shadow-md transition-all"
                      loading="lazy"
                      onError={(e) => {
                        // Fallback to regular image if dark mode image fails
                        if (isDarkMode && pdf.dark_mode_images_base && e.target.src.includes('-dark-')) {
                          e.target.src = `/thumbnails/${pdf.images_base}-1.png`;
                        }
                      }}
                    />
                  </div>
                )}

                {/* Labels - Bottom Left (Bigger) */}
                {pdf.labels && pdf.labels.length > 0 && (
                  <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
                    {pdf.labels.map((label) => (
                      <span
                        key={label.id}
                        className="px-4 py-2 text-base font-bold text-white rounded-lg shadow-lg"
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
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-gray-800/60 hover:bg-gray-900/80 dark:bg-black/50 dark:hover:bg-black/70 text-white p-4 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed z-10"
            aria-label="Previous"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={handleNext}
            disabled={currentIndex === displayPdfs.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-gray-800/60 hover:bg-gray-900/80 dark:bg-black/50 dark:hover:bg-black/70 text-white p-4 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed z-10"
            aria-label="Next"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Position Indicator with Dots and Page Number */}
      {displayPdfs.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-gray-800/60 dark:bg-black/50 px-4 py-2 rounded-full z-10 transition-colors">
          {/* Page Number */}
          <div className="text-white text-sm font-medium whitespace-nowrap">
            {currentIndex + 1} / {displayPdfs.length}
          </div>
          {/* Separator */}
          <div className="w-px h-4 bg-white/30"></div>
          {/* Dots */}
          <div className="flex gap-2">
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
        </div>
      )}

      {/* Floating Close Button - Top Right */}
      <button
        onClick={onClose}
        className="fixed top-20 right-4 sm:right-6 z-50 bg-gray-900/80 hover:bg-gray-800/90 dark:bg-black/80 dark:hover:bg-black/90 text-white p-3 sm:p-4 rounded-full transition-all shadow-2xl backdrop-blur-sm"
        aria-label="Close slideshow"
      >
        <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    </>
  );
}

export default SlideShowView;
