import React, { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';

function SlideShowView({ pdfs, initialIndex = 0, onClose = null, enteredViaClick = false, isClosing = false, onAnimationComplete = null, originRect = null, onIndexChange = null, aspectWidth = 11, aspectHeight = 10 }) {
  const scrollContainerRef = useRef(null);
  const containerRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isScrolling, setIsScrolling] = useState(false);
  const [animationState, setAnimationState] = useState('zoom-in');
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [animationTransform, setAnimationTransform] = useState(null);
  const [showCloseButton, setShowCloseButton] = useState(false);
  const [referenceImageDimensions, setReferenceImageDimensions] = useState(null);
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);

  // pdfs are already filtered (no nulls/undefined) from parent component
  const displayPdfs = pdfs;

  // Detect mobile portrait mode
  useEffect(() => {
    const checkOrientation = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      const isMobile = window.innerWidth < 768; // Tailwind's md breakpoint
      setIsMobilePortrait(isMobile && isPortrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Get reference image dimensions from latest (most recent) non-placeholder PDF
  useEffect(() => {
    // Find the last non-placeholder PDF (most recent upload)
    const referencePdf = [...displayPdfs].reverse().find(pdf => !pdf.is_placeholder);

    if (!referencePdf) {
      console.warn('[SlideShowView] No reference PDF found - all PDFs are placeholders!');
      return;
    }

    const isDarkMode = darkMode || (document.documentElement.classList.contains('dark') && !darkMode);
    const imagesBase = (isDarkMode && referencePdf.dark_mode_images_base) ? referencePdf.dark_mode_images_base : referencePdf.images_base;
    const imageSrc = imagesBase ? `/thumbnails/${imagesBase}-1.png` : `/thumbnails/${referencePdf.thumbnail}`;

    const img = new Image();
    img.onload = () => {
      const dimensions = {
        width: img.naturalWidth,
        height: img.naturalHeight,
        aspectRatio: img.naturalWidth / img.naturalHeight
      };
      setReferenceImageDimensions(dimensions);
    };
    img.onerror = (e) => {
      console.error('[SlideShowView] Failed to load reference image:', imageSrc, e);
    };
    img.src = imageSrc;
  }, [displayPdfs, darkMode]);

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

    // Account for scroll offset when calculating origin center
    // getBoundingClientRect is viewport-relative, but we need to account for any scroll changes
    const currentScrollY = window.scrollY || window.pageYOffset;
    const scrollYDelta = originRect.scrollY !== undefined ? currentScrollY - originRect.scrollY : 0;

    // Calculate the center of the clicked element (adjusted for scroll changes)
    const originCenterX = originRect.left + (originRect.width / 2);
    const originCenterY = originRect.top + (originRect.height / 2) - scrollYDelta;

    // Calculate the center of the SLIDESHOW CONTAINER (not full viewport)
    // Container is fixed with top-16 (64px) and bottom-0
    const headerOffset = 64; // 4rem = 64px
    const containerHeight = viewportHeight - headerOffset;
    const viewportCenterX = viewportWidth / 2;
    const viewportCenterY = headerOffset + (containerHeight / 2); // Center of container, not viewport

    // Calculate translation needed to move container center TO grid item center
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

    console.log('%c[SlideShowView] Animation Transform ' + (isClosing ? '(CLOSING)' : '(OPENING)'), 'background: #2563eb; color: white; padding: 4px 8px; border-radius: 3px; font-weight: bold;', {
      'Animation Target': {
        translateX: clampedTranslateX.toFixed(2) + 'px',
        translateY: clampedTranslateY.toFixed(2) + 'px',
        scale: scale.toFixed(4)
      },
      'Scroll Adjustment': {
        scrollYDelta: scrollYDelta + 'px',
        currentScrollY: currentScrollY + 'px',
        capturedScrollY: originRect.scrollY + 'px',
        adjustment: scrollYDelta !== 0 ? '⚠️ ADJUSTED' : '✓ No adjustment needed'
      },
      'Position Calculation': {
        originCenterY: originCenterY.toFixed(2) + 'px',
        viewportCenterY: viewportCenterY.toFixed(2) + 'px',
        difference: (originCenterY - viewportCenterY).toFixed(2) + 'px'
      },
      'Origin Rect': {
        top: originRect.top + 'px',
        left: originRect.left + 'px',
        width: originRect.width + 'px',
        height: originRect.height + 'px'
      }
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
      const timer = setTimeout(() => {
        setAnimationState('none');
      }, 400); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, []);

  // Handle zoom-out animation when closing
  useEffect(() => {
    if (isClosing) {
      console.log('%c[SlideShowView] Closing animation started', 'background: #dc2626; color: white; padding: 4px 8px; border-radius: 3px; font-weight: bold;');

      // IMPORTANT: Scroll to current index immediately before animation
      // This ensures the currently visible item is properly centered
      scrollToIndex(currentIndex, true); // immediate = true for instant scroll

      setAnimationState('zoom-out');
      const timer = setTimeout(() => {
        if (onAnimationComplete) {
          onAnimationComplete();
        }
      }, 400); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, [isClosing, onAnimationComplete, currentIndex, scrollToIndex]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setIsScrolling(true);
      const scrollLeft = container.scrollLeft;
      // Mobile portrait: 100% width, no spacers. Landscape/desktop: 60% width with 20% spacers
      const slideWidthPercent = isMobilePortrait ? 1.0 : 0.6;
      const leftSpacerPercent = isMobilePortrait ? 0 : 0.2;
      const slideWidth = container.offsetWidth * slideWidthPercent;
      const leftSpacer = container.offsetWidth * leftSpacerPercent;
      const index = Math.round((scrollLeft - leftSpacer) / slideWidth);
      setCurrentIndex(index);

      // Clear the scrolling state after a delay
      const timeout = setTimeout(() => {
        setIsScrolling(false);
      }, 150);

      return () => clearTimeout(timeout);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isMobilePortrait]);

  // Report current index to parent
  useEffect(() => {
    if (onIndexChange) {
      onIndexChange(currentIndex);
    }
  }, [currentIndex, onIndexChange]);

  const scrollToIndex = useCallback((index, immediate = false) => {
    const container = scrollContainerRef.current;
    if (container) {
      // Mobile portrait: 100% width, no spacers. Landscape/desktop: 60% width with 20% spacers
      const slideWidthPercent = isMobilePortrait ? 1.0 : 0.6;
      const leftSpacerPercent = isMobilePortrait ? 0 : 0.2;
      const slideWidth = container.offsetWidth * slideWidthPercent;
      const leftSpacer = container.offsetWidth * leftSpacerPercent;
      container.scrollTo({
        left: leftSpacer + (index * slideWidth),
        behavior: immediate ? 'auto' : 'smooth'
      });
    }
  }, [isMobilePortrait]);

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
    const container = scrollContainerRef.current;

    if (container && initialIndex >= 0 && initialIndex < displayPdfs.length) {
      // Mobile portrait: 100% width, no spacers. Landscape/desktop: 60% width with 20% spacers
      const slideWidthPercent = isMobilePortrait ? 1.0 : 0.6;
      const leftSpacerPercent = isMobilePortrait ? 0 : 0.2;

      const slideWidth = container.offsetWidth * slideWidthPercent;
      const leftSpacer = container.offsetWidth * leftSpacerPercent;
      const scrollPosition = leftSpacer + (initialIndex * slideWidth);
      container.scrollLeft = scrollPosition;

      // Set currentIndex immediately to match initialIndex
      setCurrentIndex(initialIndex);
    }
  }, [isMobilePortrait]);

  // Show close button after delay, only if entered via click
  useEffect(() => {
    if (enteredViaClick && !isClosing) {
      const timer = setTimeout(() => {
        setShowCloseButton(true);
      }, 1000); // 1 second delay

      return () => clearTimeout(timer);
    } else {
      setShowCloseButton(false);
    }
  }, [enteredViaClick, isClosing]);

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
  // Using inset-x-0 top-16 bottom-0 to start below header while remaining fullscreen
  const containerClass = "fixed inset-x-0 top-16 bottom-0 bg-white dark:bg-black z-50 transition-colors";
  const containerStyle = {};

  // Generate dynamic CSS animations based on originRect
  const generateAnimationCSS = () => {
    if (!animationTransform) {
      // Fallback to simple center zoom if no transform calculated
      // Using translate3d for hardware acceleration
      return `
        @keyframes zoomIn {
          from {
            opacity: 0;
            transform: scale(0.85) translate3d(0, 0, 0);
          }
          to {
            opacity: 1;
            transform: scale(1) translate3d(0, 0, 0);
          }
        }
        @keyframes zoomOut {
          from {
            opacity: 1;
            transform: scale(1) translate3d(0, 0, 0);
          }
          to {
            opacity: 0;
            transform: scale(0.85) translate3d(0, 0, 0);
          }
        }
      `;
    }

    const { scale, translateX, translateY } = animationTransform;

    // Initial state: positioned at grid item location, scaled to grid item size
    // Final state: centered (translate 0,0,0), fullscreen (scale 1)
    // Using translate3d for hardware acceleration on mobile devices
    return `
      @keyframes zoomIn {
        from {
          opacity: 0.3;
          transform: translate3d(${translateX}px, ${translateY}px, 0) scale(${scale});
        }
        to {
          opacity: 1;
          transform: translate3d(0, 0, 0) scale(1);
        }
      }
      @keyframes zoomOut {
        from {
          opacity: 1;
          transform: translate3d(0, 0, 0) scale(1);
        }
        to {
          opacity: 0.3;
          transform: translate3d(${translateX}px, ${translateY}px, 0) scale(${scale});
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
            will-change: transform, opacity;
          }
          .zoom-out-animation {
            animation: zoomOut 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            will-change: transform, opacity;
          }
          .animate-fade-in {
            animation: fadeIn 0.3s ease-in;
            will-change: transform, opacity;
          }
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: scale(0.95) translate3d(0, 0, 0);
            }
            to {
              opacity: 1;
              transform: scale(1) translate3d(0, 0, 0);
            }
          }
        `}
      </style>
      <div
        ref={containerRef}
        className={`${containerClass} ${animationState === 'zoom-in' ? 'zoom-in-animation' : ''} ${animationState === 'zoom-out' ? 'zoom-out-animation' : ''}`}
        style={{
          ...containerStyle,
          // Hardware acceleration for smoother animations on mobile
          willChange: animationState !== 'none' ? 'transform, opacity' : 'auto',
          transform: animationState === 'none' ? 'translate3d(0, 0, 0)' : undefined,
        }}
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
            // Hardware acceleration for smooth scrolling
            transform: 'translate3d(0, 0, 0)',
            willChange: 'scroll-position',
          }}
        >
        {/* Left spacer - allows first slide to center (hidden in mobile portrait) */}
        {!isMobilePortrait && <div className="flex-shrink-0 w-[20%] h-full snap-start"></div>}

        {displayPdfs.map((pdf, index) => {
          // Determine which image to show based on dark mode
          const isDarkMode = darkMode || (document.documentElement.classList.contains('dark') && !darkMode);
          const imagesBase = (isDarkMode && pdf.dark_mode_images_base) ? pdf.dark_mode_images_base : pdf.images_base;
          const imageSrc = imagesBase ? `/thumbnails/${imagesBase}-1.png` : `/thumbnails/${pdf.thumbnail}`;

          return (
            <div
              key={pdf.id}
              className={`flex-shrink-0 ${isMobilePortrait ? 'w-full' : 'w-[60%]'} h-full snap-center flex flex-col ${isMobilePortrait ? 'p-2' : 'p-4'}`}
            >
              {/* Image Container - flex-1 to fill available height */}
              <div className="relative flex-1 max-w-6xl w-full mx-auto flex items-center justify-center overflow-hidden">
                {pdf.is_placeholder ? (
                  (() => {
                    return (
                      <div className="relative w-full h-full flex items-center justify-center">
                        {referenceImageDimensions ? (
                          <>
                            {/* Sized container matching aspect ratio */}
                            <div
                              className="relative w-full max-h-full"
                              style={{
                                aspectRatio: referenceImageDimensions.aspectRatio
                              }}
                            >
                              {/* Placeholder content */}
                              <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-lg shadow-md border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center p-4 sm:p-6 md:p-8 transition-colors">
                                <p className="text-gray-600 dark:text-gray-400 font-bold text-center break-words leading-tight whitespace-pre-wrap transition-colors" style={{ fontSize: isMobilePortrait ? 'clamp(0.6rem, 4vw, 2rem)' : 'clamp(0.8rem, 2.5vw, 2.5rem)' }}>
                                  {pdf.placeholder_text || 'PLACEHOLDER'}
                                </p>
                              </div>
                            </div>
                          </>
                        ) : (
                          /* Fallback when no reference dimensions available */
                          <div
                            className="w-full max-h-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-lg shadow-md border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center p-4 sm:p-6 md:p-8 transition-colors"
                            style={{
                              aspectRatio: `${aspectWidth} / ${aspectHeight}`
                            }}
                          >
                            <p className="text-gray-600 dark:text-gray-400 font-bold text-center break-words leading-tight whitespace-pre-wrap transition-colors" style={{ fontSize: isMobilePortrait ? 'clamp(0.6rem, 4vw, 2rem)' : 'clamp(0.8rem, 2.5vw, 2.5rem)' }}>
                              {pdf.placeholder_text || 'PLACEHOLDER'}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <img
                    key={`${pdf.id}-${isDarkMode ? 'dark' : 'light'}`}
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
                )}

                {/* Labels - Top Left (Bigger) */}
                {pdf.labels && pdf.labels.length > 0 && (
                  <div className="absolute top-4 left-4 flex flex-wrap gap-2">
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

        {/* Right spacer - allows last slide to center (hidden in mobile portrait) */}
        {!isMobilePortrait && <div className="flex-shrink-0 w-[20%] h-full snap-end"></div>}
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

      {/* Floating Close Button - Top Right (only shown if entered via click, after 1s delay) */}
      {showCloseButton && (
        <button
          onClick={onClose}
          className="fixed top-20 right-4 sm:right-6 z-50 bg-gray-900/80 hover:bg-gray-800/90 dark:bg-black/80 dark:hover:bg-black/90 text-white p-3 sm:p-4 rounded-full transition-all shadow-2xl backdrop-blur-sm animate-fade-in"
          aria-label="Close slideshow"
        >
          <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
    </>
  );
}

export default SlideShowView;
