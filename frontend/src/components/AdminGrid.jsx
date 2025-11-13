import React, { useState } from 'react';
import DraggablePDFCard from './DraggablePDFCard';

function AdminGrid({ pdfs, rows, cols, editMode, onReorder, onDelete }) {
  const [draggedItem, setDraggedItem] = useState(null);

  const totalSlots = rows * cols;

  const handleDragStart = (index) => {
    setDraggedItem(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === index) return;

    const newPdfs = [...pdfs];
    const draggedPdf = newPdfs[draggedItem];
    newPdfs.splice(draggedItem, 1);
    newPdfs.splice(index, 0, draggedPdf);

    setDraggedItem(index);
    onReorder(newPdfs);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const gridStyle = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
  };

  return (
    <div className="grid gap-4 w-full" style={gridStyle}>
      {Array.from({ length: totalSlots }).map((_, index) => {
        const pdf = pdfs[index];

        return (
          <div
            key={index}
            onDragOver={(e) => editMode && handleDragOver(e, index)}
            className="aspect-[5/7]"
          >
            {pdf ? (
              <DraggablePDFCard
                pdf={pdf}
                index={index}
                editMode={editMode}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDelete={onDelete}
                isDragging={draggedItem === index}
              />
            ) : (
              <div className="w-full h-full bg-gray-200 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                {editMode && (
                  <span className="text-gray-400 text-sm">Empty</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default AdminGrid;
