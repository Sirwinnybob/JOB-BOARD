import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import SortableGridItem from './SortableGridItem';

function AdminGrid({ pdfs, rows, cols, editMode, onReorder, onDelete, onLabelClick, onSlotMenuOpen, showSlotMenu, onSlotMenuClose, onAddPlaceholder, onUploadToSlot, onMoveToPending }) {
  const totalSlots = rows * cols;

  const gridStyle = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
  };

  // Create IDs for all slots
  const slotIds = Array.from({ length: totalSlots }, (_, i) => `board-${i}`);

  const { setNodeRef } = useDroppable({
    id: 'board',
  });

  return (
    <SortableContext items={slotIds} strategy={rectSortingStrategy}>
      <div
        ref={setNodeRef}
        className="grid gap-4 w-full"
        style={gridStyle}
      >
        {Array.from({ length: totalSlots }).map((_, index) => {
          const pdf = pdfs[index];

          return (
            <SortableGridItem
              key={`board-${index}`}
              id={`board-${index}`}
              pdf={pdf}
              index={index}
              editMode={editMode}
              onDelete={onDelete}
              onLabelClick={onLabelClick}
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
    </SortableContext>
  );
}

export default AdminGrid;
