import React from 'react';
import DraggableCoverSheetCard from './DraggableCoverSheetCard';

function PDFGrid({ pdfs, rows, cols, aspectWidth = 11, aspectHeight = 10, onPdfClick }) {
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

        return (
          <div
            key={pdf?.id || `empty-${index}`}
            className="flex flex-col transition-all duration-500 ease-in-out"
            style={{ aspectRatio: `${aspectWidth} / ${aspectHeight}` }}
          >
            {!pdf ? (
              <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 transition-colors" />
            ) : pdf.is_placeholder ? (
              <div className="relative w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-lg shadow-md border-2 border-dashed border-gray-300 dark:border-gray-600 overflow-hidden transition-all duration-500"
              >
                <div className="w-full h-full flex items-center justify-center p-4">
                  <p className="text-gray-600 dark:text-gray-400 text-4xl font-bold text-center break-words leading-tight transition-colors">
                    {pdf.placeholder_text || 'PLACEHOLDER'}
                  </p>
                </div>
              </div>
            ) : (
              <div
                onClick={(e) => onPdfClick(pdf, e)}
                className="w-full h-full cursor-pointer hover:opacity-90 transition-opacity"
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
