import React from 'react';

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

        if (!pdf) {
          return (
            <div
              key={`empty-${index}`}
              className="aspect-[5/7] bg-gray-200 rounded-lg border-2 border-dashed border-gray-300"
            />
          );
        }

        return (
          <div
            key={pdf.id}
            onClick={() => onPdfClick(pdf)}
            className="relative aspect-[5/7] bg-white rounded-lg shadow-md hover:shadow-xl transform hover:scale-105 transition-all duration-200 cursor-pointer overflow-hidden border border-gray-200"
          >
            <img
              src={`/thumbnails/${pdf.thumbnail}`}
              alt={pdf.original_name}
              className="w-full h-full object-cover"
              loading="lazy"
            />

            {/* Labels */}
            {pdf.labels && pdf.labels.length > 0 && (
              <div className="absolute top-2 left-2 right-2 flex flex-wrap gap-1">
                {pdf.labels.map((label) => (
                  <span
                    key={label.id}
                    className="px-2 py-0.5 text-xs font-bold text-white rounded shadow-lg"
                    style={{ backgroundColor: label.color }}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
              <p className="text-white text-xs truncate">
                {pdf.original_name.replace('.pdf', '')}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default PDFGrid;
