import React from 'react';
import DraggableGridItem from './DraggableGridItem';
import MobileActionBar from './MobileActionBar';

function AdminGrid({ pdfs, rows, cols, aspectWidth, aspectHeight, editMode, onReorder, onDelete, onLabelClick, onMetadataUpdate, onSlotMenuOpen, showSlotMenu, onSlotMenuClose, onAddPlaceholder, onUploadToSlot, onMoveToPending, onEditPlaceholder, isTransitioning, isMobile, selectedMobileCardId, onMobileCardSelect, onMobileTapToMove }) {
  const totalSlots = rows * cols;

  // Responsive columns: Cap at 4 for better mobile experience
  const responsiveCols = Math.min(cols, 4);

  const gridStyle = {
    gridTemplateColumns: `repeat(${responsiveCols}, minmax(0, 1fr))`,
  };

  console.log('[AdminGrid] Render with isTransitioning:', isTransitioning);

  // Find the selected PDF and its index for mobile action bar positioning
  const selectedPdf = selectedMobileCardId ? pdfs.find(pdf => pdf && `pdf-${pdf.id}` === selectedMobileCardId) : null;
  const selectedIndex = selectedMobileCardId ? pdfs.findIndex(pdf => pdf && `pdf-${pdf.id}` === selectedMobileCardId) : -1;

  return (
    <div className="relative">
      {/* Mobile Action Bar - positioned above the grid */}
      {isMobile && editMode && selectedPdf && (
        <div className="mb-2">
          <MobileActionBar
            pdf={selectedPdf}
            onDelete={onDelete}
            onLabelClick={selectedPdf.is_placeholder ? null : onLabelClick}
            onMoveToPending={selectedPdf.is_placeholder ? null : onMoveToPending}
            onEditPlaceholder={selectedPdf.is_placeholder ? onEditPlaceholder : null}
            onClose={() => onMobileCardSelect(null)}
          />
        </div>
      )}

      <div
        className="grid gap-2 sm:gap-4 w-full"
        style={gridStyle}
      >
        {Array.from({ length: totalSlots }).map((_, index) => {
        const pdf = pdfs[index];
        // With View Transitions API: circular reveal animates 0-0.8s
        // Grid items start fading in sync, cascading from top-left
        // Each item starts 150ms after the previous for visible cascade
        const animationDelay = isTransitioning ? `${index * 0.15}s` : '0s';

        if (isTransitioning && index < 3) {
          console.log(`[AdminGrid] Item ${index}:`, {
            animationDelay,
            hasPdf: !!pdf
          });
        }

        const isSelected = pdf && `pdf-${pdf.id}` === selectedMobileCardId;
        const isDimmed = selectedMobileCardId && !isSelected; // Dim unselected cards when something is selected
        const inMoveMode = !!selectedMobileCardId; // Track if we're in move mode (a card is selected)

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
            isMobile={isMobile}
            isSelected={isSelected}
            isDimmed={isDimmed}
            inMoveMode={inMoveMode}
            onSelect={() => pdf && onMobileCardSelect(`pdf-${pdf.id}`)}
            onTapDestination={() => onMobileTapToMove && onMobileTapToMove(index)}
          />
        );
      })}
      </div>
    </div>
  );
}

export default AdminGrid;
