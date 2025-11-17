import React from 'react';
import DraggableGridItem from './DraggableGridItem';

function AdminGrid({ pdfs, rows, cols, aspectWidth, aspectHeight, editMode, onReorder, onDelete, onLabelClick, onMetadataUpdate, onSlotMenuOpen, showSlotMenu, onSlotMenuClose, onAddPlaceholder, onUploadToSlot, onMoveToPending }) {
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
          <DraggableGridItem
            key={`board-${index}`}
            id={`board-${index}`}
            pdf={pdf}
            index={index}
            aspectWidth={aspectWidth}
            aspectHeight={aspectHeight}
            editMode={editMode}
            onDelete={onDelete}
            onLabelClick={onLabelClick}
            onMetadataUpdate={onMetadataUpdate}
            onMoveToPending={onMoveToPending}
            onSlotMenuOpen={onSlotMenuOpen}
            showSlotMenu={showSlotMenu}
            onSlotMenuClose={onSlotMenuClose}
            onAddPlaceholder={onAddPlaceholder}
            onUploadToSlot={onUploadToSlot}
          />
        );
      })}
    </div>
  );
}

export default AdminGrid;
