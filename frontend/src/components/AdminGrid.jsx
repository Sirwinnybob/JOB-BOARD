import React from 'react';
import DraggableGridItem from './DraggableGridItem';

function AdminGrid({ pdfs, rows, cols, aspectWidth, aspectHeight, editMode, onReorder, onDelete, onLabelClick, onMetadataUpdate, onSlotMenuOpen, showSlotMenu, onSlotMenuClose, onAddPlaceholder, onUploadToSlot, onMoveToPending, onEditPlaceholder, isTransitioning }) {
  const totalSlots = rows * cols;

  // Responsive columns: Cap at 4 for better mobile experience
  const responsiveCols = Math.min(cols, 4);

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
        // Stagger delays but ensure midpoint aligns: delay + (duration/2) = 400ms
        // With 400ms duration, midpoint is at delay + 200ms
        // So for midpoint at 400ms: delay = 400ms - 200ms = 200ms
        // Add small stagger: 200ms + (index * 10ms)
        const animationDelay = isTransitioning ? `${0.2 + index * 0.01}s` : '0s';

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
            onEditPlaceholder={onEditPlaceholder}
            isTransitioning={isTransitioning}
            animationDelay={animationDelay}
          />
        );
      })}
    </div>
  );
}

export default AdminGrid;
