import React, { useRef, useState, useEffect } from 'react';

function SlideShowView({ pdfs, onPdfClick }) {
  const scrollContainerRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);

  // Filter out placeholders for slideshow
  const displayPdfs = pdfs.filter(pdf => pdf && !pdf.is_placeholder);

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
      if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, displayPdfs.length]);

  if (displayPdfs.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-xl text-gray-600 dark:text-gray-400 transition-colors">
          No jobs to display
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height: 'calc(100vh - 180px)' }}>
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
        {displayPdfs.map((pdf, index) => (
          <div
            key={pdf.id}
            className="flex-shrink-0 w-full h-full snap-center flex items-center justify-center p-4"
          >
            <div
              onClick={() => onPdfClick(pdf)}
              className="relative h-full max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden cursor-pointer hover:shadow-3xl transition-all"
              style={{ aspectRatio: '5/7' }}
            >
              <img
                src={`/thumbnails/${pdf.thumbnail}`}
                alt={pdf.original_name}
                className="w-full h-full object-contain dark:invert transition-all"
                loading="lazy"
              />

              {/* Labels */}
              {pdf.labels && pdf.labels.length > 0 && (
                <div className="absolute top-4 left-4 right-4 flex flex-wrap gap-2">
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

              {/* Title overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                <p className="text-white text-lg font-medium">
                  {pdf.original_name.replace('.pdf', '')}
                </p>
              </div>
            </div>
          </div>
        ))}
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

      {/* Counter */}
      <div className="absolute top-4 right-4 bg-black/50 text-white px-4 py-2 rounded-full text-sm font-medium z-10">
        {currentIndex + 1} / {displayPdfs.length}
      </div>
    </div>
  );
}

export default SlideShowView;
