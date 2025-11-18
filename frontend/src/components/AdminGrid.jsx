import React from 'react';
import DraggableGridItem from './DraggableGridItem';

function AdminGrid({ pdfs, rows, cols, aspectWidth, aspectHeight, editMode, onReorder, onDelete, onLabelClick, onMetadataUpdate, onSlotMenuOpen, showSlotMenu, onSlotMenuClose, onAddPlaceholder, onUploadToSlot, onMoveToPending, onEditPlaceholder, isTransitioning }) {
  const totalSlots = rows * cols;

  // Responsive columns: Cap at 4 for better mobile experience
  const responsiveCols = Math.min(cols, 4);

  const gridStyle = {
    gridTemplateColumns: `repeat(${responsiveCols}, minmax(0, 1fr))`,
  };

  console.log('[AdminGrid] Render with isTransitioning:', isTransitioning);

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
        // Color should switch when opacity is lowest: animationStart + (duration/2)
        const colorDelay = isTransitioning ? `${0.8 + index * 0.15 + 0.3}s` : '0s';

        if (isTransitioning && index < 3) {
          console.log(`[AdminGrid] Item ${index}:`, {
            animationDelay,
            colorDelay,
            hasPdf: !!pdf
          });
        }

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
            colorDelay={colorDelay}
          />
        );
      })}
    </div>
  );
}

export default AdminGrid;
