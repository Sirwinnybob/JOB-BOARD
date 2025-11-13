import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import DraggablePDFCard from './DraggablePDFCard';
import PlaceholderCard from './PlaceholderCard';

function AdminGrid({ pdfs, rows, cols, editMode, onReorder, onDelete, onLabelClick, onSlotMenuOpen, showSlotMenu, onSlotMenuClose, onAddPlaceholder, onUploadToSlot, onMoveToPending }) {
  const totalSlots = rows * cols;

  const gridStyle = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
  };

  return (
    <Droppable droppableId="board" direction="horizontal" isDropDisabled={!editMode}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className="grid gap-4 w-full"
          style={gridStyle}
        >
          {Array.from({ length: totalSlots }).map((_, index) => {
            const pdf = pdfs[index];

            return (
              <div
                key={pdf?.id || `empty-${index}`}
                className="aspect-[5/7]"
              >
                {pdf ? (
                  <Draggable
                    draggableId={`pdf-${pdf.id}`}
                    index={index}
                    isDragDisabled={!editMode}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`w-full h-full ${snapshot.isDragging ? 'opacity-40' : ''}`}
                      >
                        {pdf.is_placeholder ? (
                          <PlaceholderCard
                            placeholder={pdf}
                            index={index}
                            editMode={editMode}
                            onDelete={onDelete}
                            isDragging={snapshot.isDragging}
                          />
                        ) : (
                          <DraggablePDFCard
                            pdf={pdf}
                            index={index}
                            editMode={editMode}
                            onDelete={onDelete}
                            onLabelClick={onLabelClick}
                            onMoveToPending={onMoveToPending}
                            isDragging={snapshot.isDragging}
                          />
                        )}
                      </div>
                    )}
                  </Draggable>
                ) : (
                  <div className="w-full h-full bg-gray-200 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center relative group">
                    {editMode ? (
                      showSlotMenu === index ? (
                        <div className="absolute inset-0 bg-white rounded-lg shadow-lg z-20 flex flex-col items-stretch justify-center p-4 gap-2">
                          <button
                            onClick={() => onAddPlaceholder && onAddPlaceholder(index)}
                            className="flex items-center justify-center gap-2 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm font-medium">Placeholder</span>
                          </button>
                          <button
                            onClick={() => onUploadToSlot && onUploadToSlot(index)}
                            className="flex items-center justify-center gap-2 p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <span className="text-sm font-medium">Upload PDF</span>
                          </button>
                          <button
                            onClick={onSlotMenuClose}
                            className="p-2 text-gray-600 hover:text-gray-900 transition-colors text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onSlotMenuOpen && onSlotMenuOpen(index)}
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
                            Add Item
                          </span>
                        </button>
                      )
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}

export default AdminGrid;
