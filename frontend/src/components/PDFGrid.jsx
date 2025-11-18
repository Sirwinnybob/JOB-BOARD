import React from 'react';
import DraggableCoverSheetCard from './DraggableCoverSheetCard';
import PublicPlaceholder from './PublicPlaceholder';
import EmptySlot from './EmptySlot';

function PDFGrid({ pdfs, rows, cols, aspectWidth = 11, aspectHeight = 10, onPdfClick, isTransitioning, highlightedJobId }) {
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
        // Color changes at each item's opacity midpoint
        // Delay is relative to when DOM class changes (t=400ms), not from t=0!
        // Midpoint: 0.8s + index*0.15s + 0.3s, minus 0.4s for DOM class timing
        const colorTransitionDelay = isTransitioning ? `${0.8 + index * 0.15 + 0.3 - 0.4}s` : '0s';

        return (
          <div
            key={pdf?.id || `empty-${index}`}
            className={`flex flex-col ${isTransitioning ? 'animate-theme-item' : 'transition-all duration-500 ease-in-out'}`}
            style={{
              aspectRatio: `${aspectWidth} / ${aspectHeight}`,
              animationDelay,
            }}
          >
            {!pdf ? (
              <EmptySlot colorTransitionDelay={colorTransitionDelay} />
            ) : pdf.is_placeholder ? (
              <PublicPlaceholder
                placeholder={pdf}
                colorTransitionDelay={colorTransitionDelay}
                onClick={(e) => onPdfClick(pdf, e)}
              />
            ) : (
              <div
                onClick={(e) => onPdfClick(pdf, e)}
                className={`w-full h-full cursor-pointer hover:opacity-90 ${!isTransitioning ? 'transition-opacity' : ''}`}
                data-pdf-id={pdf.id}
              >
                <DraggableCoverSheetCard
                  pdf={pdf}
                  index={index}
                  editMode={false}
                  isDragging={false}
                  colorTransitionDelay={colorTransitionDelay}
                  isHighlighted={highlightedJobId === pdf.id}
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
