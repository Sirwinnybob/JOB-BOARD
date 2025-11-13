import React, { useState } from 'react';
import DraggablePDFCard from './DraggablePDFCard';
import PlaceholderCard from './PlaceholderCard';

function AdminGrid({ pdfs, rows, cols, editMode, onReorder, onDelete, onLabelClick, onAddPlaceholder }) {
  const [draggedItem, setDraggedItem] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);

  const totalSlots = rows * cols;

  const handleDragStart = (index) => {
    setDraggedItem(index);
    setHoverIndex(null);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === index) return;

    // Only update the hover index for visual feedback
    // Don't modify the array until drop
    setHoverIndex(index);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === index) return;

    // Only now do we actually reorder the array
    const newPdfs = [...pdfs];
    const draggedPdf = newPdfs[draggedItem];
    newPdfs.splice(draggedItem, 1);
    newPdfs.splice(index, 0, draggedPdf);

    onReorder(newPdfs);
    setDraggedItem(null);
    setHoverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setHoverIndex(null);
  };

  const gridStyle = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
  };

  return (
    <div className="grid gap-4 w-full" style={gridStyle}>
      {Array.from({ length: totalSlots }).map((_, index) => {
        const pdf = pdfs[index];
        const isHovered = hoverIndex === index && draggedItem !== null;

        return (
          <div
            key={pdf?.id || index}
            onDragOver={(e) => editMode && handleDragOver(e, index)}
            onDrop={(e) => editMode && handleDrop(e, index)}
            className="aspect-[5/7] transition-all duration-300 ease-in-out"
            style={{
              transform: draggedItem === index ? 'scale(0.95)' : isHovered ? 'scale(1.05)' : 'scale(1)',
              opacity: draggedItem === index ? 0.5 : 1,
            }}
          >
            {pdf ? (
              pdf.is_placeholder ? (
                <PlaceholderCard
                  placeholder={pdf}
                  index={index}
                  editMode={editMode}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDelete={onDelete}
                  isDragging={draggedItem === index}
                />
              ) : (
                <DraggablePDFCard
                  pdf={pdf}
                  index={index}
                  editMode={editMode}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDelete={onDelete}
                  onLabelClick={onLabelClick}
                  isDragging={draggedItem === index}
                />
              )
            ) : (
              <div className="w-full h-full bg-gray-200 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center relative group">
                {editMode ? (
                  <button
                    onClick={() => onAddPlaceholder && onAddPlaceholder(index)}
                    className="flex flex-col items-center justify-center gap-2 p-4 hover:bg-gray-300 transition-colors w-full h-full rounded-lg"
                  >
                    <svg
                      className="w-8 h-8 text-gray-400 group-hover:text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    <span className="text-gray-400 text-sm group-hover:text-gray-600">
                      Add Placeholder
                    </span>
                  </button>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default AdminGrid;
