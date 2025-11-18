import React from 'react';
import DraggableCoverSheetCard from './DraggableCoverSheetCard';

function PDFGrid({ pdfs, rows, cols, aspectWidth = 11, aspectHeight = 10, onPdfClick, isTransitioning }) {
  const totalSlots = rows * cols;

  // Responsive columns: 1 on mobile, 2 on small tablets, full cols on larger screens
  const responsiveCols = Math.min(cols, 4); // Cap at 4 for better mobile experience

  const gridStyle = {
    gridTemplateColumns: `repeat(${responsiveCols}, minmax(0, 1fr))`,
  };

  return (
    <div
      className="grid gap-2 sm:gap-4 w-full"
      style={gridStyle}
    >
      {Array.from({ length: totalSlots }).map((_, index) => {
        const pdf = pdfs[index];
        // Start grid items after background/header finish (at 0.8s)
        // Each item starts 150ms after the previous for visible cascade
        const animationDelay = isTransitioning ? `${0.8 + index * 0.15}s` : '0s';
        // Color changes at each item's opacity midpoint (animationStart + 300ms)
        const colorTransitionDelay = isTransitioning ? `${0.8 + index * 0.15 + 0.3}s` : '0s';

        return (
          <div
            key={pdf?.id || `empty-${index}`}
            className={`flex flex-col ${isTransitioning ? 'animate-theme-item' : 'transition-all duration-500 ease-in-out'}`}
            style={{
              aspectRatio: `${aspectWidth} / ${aspectHeight}`,
              animationDelay,
              // Delay color changes to match this item's opacity midpoint
              ...(isTransitioning && {
                transition: `background-color 0.1s ease ${colorTransitionDelay}, color 0.1s ease ${colorTransitionDelay}, border-color 0.1s ease ${colorTransitionDelay}`
              })
            }}
          >
            {!pdf ? (
              <div className={`w-full h-full bg-gray-200 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 ${!isTransitioning ? 'transition-colors' : ''}`} />
            ) : pdf.is_placeholder ? (
              <div
                onClick={(e) => onPdfClick(pdf, e)}
                className={`relative w-full h-full ${isTransitioning ? 'bg-gray-100 dark:bg-gray-700' : 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800'} rounded-lg shadow-md border-2 border-dashed border-gray-300 dark:border-gray-600 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ${!isTransitioning ? 'transition-all duration-500' : ''}`}
                data-pdf-id={pdf.id}
              >
                <div className="w-full h-full flex items-center justify-center p-2 sm:p-3 md:p-4">
                  <p className={`text-gray-600 dark:text-gray-400 text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-center break-words leading-tight ${!isTransitioning ? 'transition-colors' : ''}`}>
                    {pdf.placeholder_text || 'PLACEHOLDER'}
                  </p>
                </div>
              </div>
            ) : (
              <div
                onClick={(e) => onPdfClick(pdf, e)}
                className="w-full h-full cursor-pointer hover:opacity-90 transition-opacity"
                data-pdf-id={pdf.id}
              >
                <DraggableCoverSheetCard
                  pdf={pdf}
                  index={index}
                  editMode={false}
                  isDragging={false}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default PDFGrid;
