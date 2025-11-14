import React, { useState } from 'react';
import { pdfAPI } from '../utils/api';
import { useDarkMode } from '../contexts/DarkModeContext';

function DraggableCoverSheetCard({
  pdf,
  index,
  editMode,
  onDelete,
  onLabelClick,
  onMoveToPending,
  isDragging,
  onMetadataUpdate,
}) {
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const { isDarkMode } = useDarkMode();

  // Determine which image to use based on dark mode
  const imageBaseName = isDarkMode && pdf.dark_mode_images_base
    ? pdf.dark_mode_images_base
    : pdf.images_base;
  const imageSrc = imageBaseName ? `/thumbnails/${imageBaseName}-1.png` : `/thumbnails/${pdf.thumbnail}`;

  const handleStartEdit = (field, currentValue) => {
    setEditing(field);
    setEditValue(currentValue || '');
  };

  const handleSaveEdit = async (field) => {
    try {
      const updates = {};
      if (field === 'job_number') {
        updates.job_number = editValue;
        updates.construction_method = pdf.construction_method;
      } else {
        updates.job_number = pdf.job_number;
        updates.construction_method = editValue;
      }

      await pdfAPI.updateMetadata(pdf.id, updates.job_number, updates.construction_method);
      if (onMetadataUpdate) {
        onMetadataUpdate(pdf.id, updates);
      }
      setEditing(null);
    } catch (error) {
      console.error('Error updating metadata:', error);
      alert('Failed to update metadata');
    }
  };

  const handleCancelEdit = () => {
    setEditing(null);
    setEditValue('');
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Job Info Section - At top of slot */}
      <div className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-t px-2 py-1 flex justify-between items-center text-xs transition-colors shadow-sm z-10 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-gray-600 dark:text-gray-400">Job#:</span>
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
                className={`flex-1 truncate px-1 rounded text-gray-900 dark:text-white ${
                  editMode ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : 'cursor-default'
                }`}
                title={editMode ? (pdf.job_number || 'Click to add job number') : pdf.job_number}
              >
                {pdf.job_number || '—'}
              </span>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0 ml-2">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-gray-600 dark:text-gray-400">Type:</span>
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
                className={`flex-1 truncate px-1 rounded text-gray-900 dark:text-white ${
                  editMode ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : 'cursor-default'
                }`}
                title={editMode ? (pdf.construction_method || 'Click to select type') : pdf.construction_method}
              >
                {pdf.construction_method || '—'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Cover Sheet Card */}
      <div
        className={`flex-1 relative bg-white dark:bg-gray-800 rounded-b-lg shadow-md overflow-hidden transition-all min-h-0 ${
          editMode ? 'cursor-move border-2 animate-border-pulse' : 'cursor-default border border-gray-200 dark:border-gray-700'
        } ${isDragging ? 'opacity-50' : ''}`}
      >
      <img
        src={imageSrc}
        alt={pdf.original_name}
        className="w-full h-full object-cover transition-all"
        draggable={false}
      />

      {/* Labels */}
      {pdf.labels && pdf.labels.length > 0 && (
        <div className="absolute top-2 left-2 right-2 flex flex-wrap gap-1">
          {pdf.labels.map((label) => (
            <span
              key={label.id}
              className="px-2 py-0.5 text-xs font-bold text-white rounded shadow-lg"
              style={{ backgroundColor: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Label management button in edit mode */}
      {editMode && onLabelClick && !isDragging && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLabelClick(pdf);
          }}
          className="absolute bottom-2 right-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg transition-colors z-10"
          aria-label="Manage Labels"
          title="Manage Labels"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
        </button>
      )}

      {/* Action buttons in edit mode */}
      {editMode && (
        <>
          {/* Move to Pending button */}
          {onMoveToPending && (
            <button
              onClick={() => onMoveToPending(pdf.id)}
              className="absolute top-2 right-12 bg-yellow-600 hover:bg-yellow-700 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg transition-colors z-10"
              aria-label="Move to Pending"
              title="Move to Pending"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          )}
          {/* Delete button */}
          <button
            onClick={() => onDelete(pdf.id)}
            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg transition-colors z-10"
            aria-label="Delete"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </>
      )}

      {/* Drag indicator */}
      {editMode && !isDragging && (
        <div className="absolute top-2 left-2 bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8h16M4 16h16"
            />
          </svg>
        </div>
      )}
      </div>
    </div>
  );
}

export default DraggableCoverSheetCard;
