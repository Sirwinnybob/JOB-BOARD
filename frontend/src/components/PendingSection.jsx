import React, { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useDarkMode } from '../contexts/DarkModeContext';

function DraggablePendingItem({ pdf, index, onMovePdfToBoard, onDelete, editMode, onMetadataUpdate }) {
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const { darkMode, isTransitioning } = useDarkMode();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `pending-pdf-${pdf.id}`,
    data: {
      pdf,
      index,
      container: 'pending',
    },
    disabled: !editMode,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    willChange: 'transform',
  } : {
    transition: 'transform 200ms ease',
  };

  const draggingStyle = isDragging ? {
    pointerEvents: 'none',
  } : {};

  const handleStartEdit = (field, currentValue) => {
    setEditing(field);
    setEditValue(currentValue || '');
  };

  const handleSaveEdit = (field) => {
    const updates = {};
    if (field === 'job_number') {
      updates.job_number = editValue;
      updates.construction_method = pdf.construction_method;
    } else {
      updates.job_number = pdf.job_number;
      updates.construction_method = editValue;
    }

    // Only update local state - don't save to backend until Save button is pressed
    if (onMetadataUpdate) {
      onMetadataUpdate(pdf.id, updates);
    }
    setEditing(null);
  };

  const handleCancelEdit = () => {
    setEditing(null);
    setEditValue('');
  };

  // Determine header background color based on construction method
  const getHeaderStyle = () => {
    if (!pdf.construction_method) {
      return darkMode
        ? { backgroundColor: 'rgb(55, 65, 81)' } // dark:bg-gray-700
        : { backgroundColor: 'white' };
    }

    const colorMap = {
      'Face Frame': 'rgb(150, 179, 82)',
      'Frameless': 'rgb(237, 146, 35)',
      'Both': 'rgb(0, 133, 138)'
    };

    return { backgroundColor: colorMap[pdf.construction_method] || 'white' };
  };

  return (
    <div
      ref={setNodeRef}
      style={{...style, ...draggingStyle}}
      {...attributes}
      {...listeners}
      className={`relative bg-white dark:bg-gray-800 border-2 border-yellow-300 dark:border-yellow-600 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col ${
        editMode ? 'cursor-move' : ''
      } ${isDragging ? 'opacity-40' : ''}`}
    >
      {/* Job Info Header */}
      <div
        className={`border-b border-yellow-300 dark:border-yellow-600 px-2 py-1 flex justify-between items-center text-xs ${!isTransitioning ? 'transition-colors' : ''} shadow-sm z-10 flex-shrink-0`}
        style={getHeaderStyle()}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            {editMode && editing === 'job_number' ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit('job_number');
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                onBlur={() => handleSaveEdit('job_number')}
                className="flex-1 px-1 py-0.5 border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:outline-none"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                onClick={(e) => {
                  if (editMode) {
                    e.stopPropagation();
                    handleStartEdit('job_number', pdf.job_number);
                  }
                }}
                className={`flex-1 truncate px-1 rounded font-bold ${
                  pdf.construction_method ? 'text-white' : 'text-gray-900 dark:text-white'
                } ${
                  editMode ? 'cursor-pointer hover:bg-black/10' : 'cursor-default'
                }`}
                title={editMode ? (pdf.job_number || 'Click to add job number') : pdf.job_number}
              >
                {pdf.job_number || '—'}
              </span>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            {editMode && editing === 'construction_method' ? (
              <select
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleSaveEdit('construction_method')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit('construction_method');
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                className="flex-1 px-1 py-0.5 border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:outline-none"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              >
                <option value="">—</option>
                <option value="Frameless">Frameless</option>
                <option value="Face Frame">Face Frame</option>
                <option value="Both">Both</option>
              </select>
            ) : (
              <span
                onClick={(e) => {
                  if (editMode) {
                    e.stopPropagation();
                    handleStartEdit('construction_method', pdf.construction_method);
                  }
                }}
                className={`flex-1 truncate px-1 rounded font-bold ${
                  pdf.construction_method ? 'text-white' : 'text-gray-900 dark:text-white'
                } ${
                  editMode ? 'cursor-pointer hover:bg-black/10' : 'cursor-default'
                }`}
                title={editMode ? (pdf.construction_method || 'Click to select type') : pdf.construction_method}
              >
                {pdf.construction_method === 'Face Frame' ? 'FF' : pdf.construction_method === 'Frameless' ? 'FL' : pdf.construction_method || '—'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Thumbnail */}
      <div className={`flex-1 aspect-[4/3] bg-gray-100 dark:bg-gray-700 flex items-center justify-center ${!isTransitioning ? 'transition-colors' : ''} min-h-0`}>
        {pdf.thumbnail ? (
          <div className="relative w-full h-full">
            {/* Light mode image */}
            <img
              src={pdf.images_base ? `/thumbnails/${pdf.images_base}-1.png` : `/thumbnails/${pdf.thumbnail}`}
              alt={pdf.original_name}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-200"
              style={{ opacity: darkMode ? 0 : 1 }}
            />
            {/* Dark mode image */}
            <img
              src={pdf.dark_mode_images_base ? `/thumbnails/${pdf.dark_mode_images_base}-1.png` : (pdf.images_base ? `/thumbnails/${pdf.images_base}-1.png` : `/thumbnails/${pdf.thumbnail}`)}
              alt={pdf.original_name}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-200"
              style={{ opacity: darkMode ? 1 : 0 }}
            />
          </div>
        ) : (
          <div className="text-gray-400 text-center p-4">
            <svg
              className="w-12 h-12 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            <span className="text-xs">PDF</span>
          </div>
        )}
      </div>

      {/* Actions - Only in edit mode */}
      {editMode && onMovePdfToBoard && onDelete && (
        <div className={`p-2 bg-white dark:bg-gray-800 border-t border-yellow-200 dark:border-yellow-700 flex gap-2 ${!isTransitioning ? 'transition-colors' : ''}`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMovePdfToBoard(pdf.id);
            }}
            className={`flex-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 ${!isTransitioning ? 'transition-colors' : ''}`}
            title="Add to Board"
          >
            Add to Board
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(pdf.id);
            }}
            className={`px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 ${!isTransitioning ? 'transition-colors' : ''}`}
            title="Delete"
          >
            Delete
          </button>
        </div>
      )}

      {/* Drag indicator - Only in edit mode */}
      {editMode && !isDragging && (
        <div className={`absolute top-2 left-2 bg-yellow-600 dark:bg-yellow-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg text-xs ${!isTransitioning ? 'transition-colors' : ''}`}>
          ⋮⋮
        </div>
      )}
    </div>
  );
}

function PendingSection({ pdfs, onMovePdfToBoard, onMoveAllPdfsToBoard, onDelete, onUploadToPending, editMode, onMetadataUpdate }) {
  const { isTransitioning } = useDarkMode();
  const { setNodeRef, isOver } = useDroppable({
    id: 'pending-container',
  });

  if (pdfs.length === 0) {
    return (
      <div className={`bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-6 ${!isTransitioning ? 'transition-colors' : ''}`}>
        <div className="flex justify-between items-center mb-2">
          <h2 className={`text-lg font-semibold text-yellow-900 dark:text-yellow-100 ${!isTransitioning ? 'transition-colors' : ''}`}>
            📥 PENDING Jobs
          </h2>
          {editMode && (
            <button
              onClick={onUploadToPending}
              className={`px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 ${!isTransitioning ? 'transition-colors' : ''} font-medium`}
            >
              + Upload to Pending
            </button>
          )}
        </div>
        <p className={`text-sm text-yellow-700 dark:text-yellow-300 ${!isTransitioning ? 'transition-colors' : ''}`}>
          {editMode
            ? 'No pending Jobs. Upload Jobs to pending using the button above.'
            : 'No pending Jobs. Enter edit mode to upload Jobs.'
          }
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-6 ${!isTransitioning ? 'transition-colors' : ''}`}>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className={`text-lg font-semibold text-yellow-900 dark:text-yellow-100 ${!isTransitioning ? 'transition-colors' : ''}`}>
            📥 PENDING Jobs ({pdfs.length})
          </h2>
          <p className={`text-sm text-yellow-700 dark:text-yellow-300 mt-1 ${!isTransitioning ? 'transition-colors' : ''}`}>
            {editMode
              ? 'These Jobs are uploaded but not yet visible on the board. Drag them to the board or click "Add to Board".'
              : 'These Jobs are uploaded but not yet visible on the board. Click to view. Enter edit mode to add them to the board.'
            }
          </p>
        </div>
        {editMode && (
          <button
            onClick={onUploadToPending}
            className={`px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 ${!isTransitioning ? 'transition-colors' : ''} font-medium whitespace-nowrap`}
          >
            + Upload to Pending
          </button>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 ${
          isOver && editMode ? 'ring-2 ring-yellow-500' : ''
        }`}
      >
        {pdfs.map((pdf, index) => (
          <DraggablePendingItem
            key={pdf.id}
            pdf={pdf}
            index={index}
            onMovePdfToBoard={onMovePdfToBoard}
            onDelete={onDelete}
            editMode={editMode}
            onMetadataUpdate={onMetadataUpdate}
          />
        ))}
      </div>

      {/* Bulk Actions - Only in edit mode */}
      {editMode && pdfs.length > 1 && onMoveAllPdfsToBoard && (
        <div className="mt-4 pt-4 border-t border-yellow-300">
          <button
            onClick={onMoveAllPdfsToBoard}
            className={`px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 ${!isTransitioning ? 'transition-colors' : ''} font-medium`}
          >
            Add All to Board ({pdfs.length})
          </button>
        </div>
      )}
    </div>
  );
}

export default PendingSection;
