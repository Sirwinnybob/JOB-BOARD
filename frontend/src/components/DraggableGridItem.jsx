import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import DraggableCoverSheetCard from './DraggableCoverSheetCard';
import PlaceholderCard from './PlaceholderCard';

function DraggableGridItem({ id, pdf, index, aspectWidth = 11, aspectHeight = 10, editMode, onDelete, onLabelClick, onMoveToPending, onMetadataUpdate, onSlotMenuOpen, showSlotMenu, onSlotMenuClose, onAddPlaceholder, onUploadToSlot, onEditPlaceholder, isTransitioning, animationDelay, isMobile, isSelected, isDimmed, inMoveMode, onSelect, onTapDestination }) {
  // Log animation timing for first few items
  React.useEffect(() => {
    if (isTransitioning && index < 3) {
      console.log(`[DraggableGridItem] Item ${index}:`, {
        isTransitioning,
        animationDelay,
        hasPdf: !!pdf,
        isPlaceholder: pdf?.is_placeholder
      });
    }
  }, [isTransitioning, index, animationDelay, pdf?.is_placeholder]);

  // Make this slot droppable
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: id,
  });

  // Make the PDF draggable if it exists
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: pdf ? `pdf-${pdf.id}` : id,
    disabled: !editMode || !pdf,
    data: {
      pdf,
      index,
      container: 'board',
    },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  if (pdf) {
    // Calculate when this item's color should change (at opacity midpoint)
    // With View Transitions: DOM class changes immediately, so delay is just animation delay + midpoint
    const colorTransitionDelay = isTransitioning ? `${index * 0.15 + 0.3}s` : '0s';

    return (
      <div
        ref={setDropRef}
        className={`flex flex-col ${isOver ? 'ring-2 ring-blue-500' : ''} ${isTransitioning ? 'animate-theme-item' : ''} ${inMoveMode && !isSelected ? 'cursor-pointer animate-slot-shine' : ''}`}
        style={{
          aspectRatio: `${aspectWidth} / ${aspectHeight}`,
          animationDelay: animationDelay,
        }}
      >
        <div
          ref={setDragRef}
          style={style}
          {...attributes}
          {...listeners}
          className={`w-full h-full ${isDragging ? 'opacity-40' : ''}`}
        >
          {pdf.is_placeholder ? (
            <PlaceholderCard
              placeholder={pdf}
              index={index}
              editMode={editMode}
              onDelete={onDelete}
              onEdit={onEditPlaceholder}
              isDragging={isDragging}
              colorTransitionDelay={colorTransitionDelay}
              isMobile={isMobile}
              isSelected={isSelected}
              isDimmed={isDimmed}
              onSelect={onSelect}
              onTapDestination={onTapDestination}
            />
          ) : (
            <DraggableCoverSheetCard
              pdf={pdf}
              index={index}
              editMode={editMode}
              onDelete={onDelete}
              onLabelClick={onLabelClick}
              onMoveToPending={onMoveToPending}
              onMetadataUpdate={onMetadataUpdate}
              isDragging={isDragging}
              colorTransitionDelay={colorTransitionDelay}
              isMobile={isMobile}
              isSelected={isSelected}
              isDimmed={isDimmed}
              onSelect={onSelect}
              onTapDestination={onTapDestination}
            />
          )}
        </div>
      </div>
    );
  }

  // Empty slot
  // Calculate when this item's color should change (at opacity midpoint)
  // With View Transitions: DOM class changes immediately, so delay is just animation delay + midpoint
  const colorTransitionDelay = isTransitioning ? `${index * 0.15 + 0.3}s` : '0s';

  return (
    <div
      ref={setDropRef}
      onClick={() => {
        // Allow tapping empty slot to move selected card there
        if (inMoveMode && onTapDestination) {
          onTapDestination();
        }
      }}
      className={`bg-gray-200 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center relative group ${!isTransitioning ? 'transition-colors' : ''} ${
        isOver ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''
      } ${isTransitioning ? 'animate-theme-item' : ''} ${
        isDimmed ? 'opacity-50' : ''
      } ${inMoveMode ? 'cursor-pointer animate-slot-shine' : ''}`}
      style={{
        aspectRatio: `${aspectWidth} / ${aspectHeight}`,
        animationDelay: animationDelay,
        // Delay color changes to match this item's opacity midpoint
        ...(isTransitioning && {
          transition: `background-color 0.1s ease ${colorTransitionDelay}, color 0.1s ease ${colorTransitionDelay}, border-color 0.1s ease ${colorTransitionDelay}`
        })
      }}
    >
      {editMode && !inMoveMode ? (
        showSlotMenu === index ? (
          <div className={`absolute inset-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-20 flex flex-col items-stretch justify-center p-4 gap-2 ${!isTransitioning ? 'transition-colors' : ''}`}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddPlaceholder && onAddPlaceholder(index);
              }}
              className={`flex items-center justify-center gap-2 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 ${!isTransitioning ? 'transition-colors' : ''}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium">Placeholder</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUploadToSlot && onUploadToSlot(index);
              }}
              className={`flex items-center justify-center gap-2 p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 ${!isTransitioning ? 'transition-colors' : ''}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm font-medium">Upload PDF</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSlotMenuClose && onSlotMenuClose();
              }}
              className={`p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 ${!isTransitioning ? 'transition-colors' : ''} text-sm`}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSlotMenuOpen && onSlotMenuOpen(index);
            }}
            className={`flex flex-col items-center justify-center gap-2 p-4 hover:bg-gray-300 dark:hover:bg-gray-600 ${!isTransitioning ? 'transition-colors' : ''} w-full h-full rounded-lg`}
          >
            <svg
              className={`w-8 h-8 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 ${!isTransitioning ? 'transition-colors' : ''}`}
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
            <span className={`text-gray-400 dark:text-gray-500 text-sm group-hover:text-gray-600 dark:group-hover:text-gray-300 ${!isTransitioning ? 'transition-colors' : ''}`}>
              Add Item
            </span>
          </button>
        )
      ) : null}
    </div>
  );
}

export default DraggableGridItem;
