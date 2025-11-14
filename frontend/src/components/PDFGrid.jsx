import React from 'react';
import DraggableCoverSheetCard from './DraggableCoverSheetCard';

function PDFGrid({ pdfs, rows, cols, onPdfClick }) {
  const totalSlots = rows * cols;
  const gridStyle = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
  };

  return (
    <div
      className="grid gap-4 w-full"
      style={gridStyle}
    >
      {Array.from({ length: totalSlots }).map((_, index) => {
        const pdf = pdfs[index];

        return (
          <div
            key={pdf?.id || `empty-${index}`}
            className="aspect-[4/3] transition-all duration-500 ease-in-out"
          >
            {!pdf ? (
              <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 transition-colors" />
            ) : pdf.is_placeholder ? (
              <div className="relative w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-lg shadow-md border-2 border-dashed border-gray-300 dark:border-gray-600 overflow-hidden transition-all duration-500"
              >
                <div className="w-full h-full flex flex-col items-center justify-center p-4">
                  <div className="bg-gray-300 dark:bg-gray-600 rounded-full p-4 mb-3 transition-colors">
                    <svg
                      className="w-12 h-12 text-gray-500 dark:text-gray-400 transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm font-medium text-center transition-colors">
                    Placeholder
                  </p>
                </div>
              </div>
            ) : (
              <div
                onClick={() => onPdfClick(pdf)}
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
