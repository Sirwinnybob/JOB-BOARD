import React, { useState } from 'react';
import DraggablePDFCard from './DraggablePDFCard';
import PlaceholderCard from './PlaceholderCard';

function AdminGrid({ pdfs, rows, cols, editMode, onReorder, onDelete, onLabelClick, onAddPlaceholder }) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const totalSlots = rows * cols;

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragEnter = (e, index) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    // Only clear if we're leaving the grid entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    e.stopPropagation();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newPdfs = [...pdfs];
    const draggedPdf = newPdfs[draggedIndex];

    // Remove from old position
    newPdfs.splice(draggedIndex, 1);
    // Insert at new position
    newPdfs.splice(dropIndex, 0, draggedPdf);

    onReorder(newPdfs);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const gridStyle = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
  };

  return (
    <div className="grid gap-4 w-full" style={gridStyle}>
      {Array.from({ length: totalSlots }).map((_, index) => {
        const pdf = pdfs[index];
        const isDragging = draggedIndex === index;
        const isDraggedOver = dragOverIndex === index && draggedIndex !== null && draggedIndex !== index;

        return (
          <div
            key={pdf?.id || `empty-${index}`}
            onDragOver={(e) => editMode && handleDragOver(e, index)}
            onDragEnter={(e) => editMode && handleDragEnter(e, index)}
            onDragLeave={(e) => editMode && handleDragLeave(e)}
            onDrop={(e) => editMode && handleDrop(e, index)}
            className={`aspect-[5/7] transition-all duration-200 ${
              isDraggedOver ? 'scale-105 ring-4 ring-blue-400 ring-opacity-50' : ''
            }`}
            style={{
              opacity: isDragging ? 0.4 : 1,
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
                  isDragging={isDragging}
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
                  isDragging={isDragging}
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
