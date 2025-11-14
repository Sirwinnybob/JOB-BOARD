import React, { useState, useEffect, useRef } from 'react';
import { ocrAPI } from '../utils/api';

function OCRSettingsPage() {
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [testImage, setTestImage] = useState(null);
  const [testImageFile, setTestImageFile] = useState(null);
  const [ocrResults, setOcrResults] = useState({});
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const imageRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    loadRegions();
  }, []);

  const loadRegions = async () => {
    try {
      const data = await ocrAPI.getRegions();
      setRegions(data);
    } catch (error) {
      console.error('Error loading OCR regions:', error);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setTestImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setTestImage(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleImageLoad = (e) => {
    setImageNaturalSize({
      width: e.target.naturalWidth,
      height: e.target.naturalHeight
    });
    drawRegions();
  };

  const drawRegions = () => {
    if (!canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = img.clientWidth / imageNaturalSize.width;
    const scaleY = img.clientHeight / imageNaturalSize.height;

    regions.forEach((region) => {
      if (region.width === 0 || region.height === 0) return;

      const x = region.x * scaleX;
      const y = region.y * scaleY;
      const width = region.width * scaleX;
      const height = region.height * scaleY;

      const isSelected = selectedRegion === region.field_name;

      ctx.strokeStyle = isSelected ? '#3b82f6' : '#10b981';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);

      ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)';
      ctx.fillRect(x, y, width, height);

      ctx.fillStyle = isSelected ? '#3b82f6' : '#10b981';
      ctx.font = '14px Arial';
      ctx.fillText(region.field_name, x + 5, y - 5);

      // Draw resize handle
      ctx.fillStyle = isSelected ? '#3b82f6' : '#10b981';
      ctx.fillRect(x + width - 8, y + height - 8, 8, 8);
    });
  };

  useEffect(() => {
    drawRegions();
  }, [regions, selectedRegion, imageNaturalSize]);

  const getMousePosition = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = imageNaturalSize.width / canvas.width;
    const scaleY = imageNaturalSize.height / canvas.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleCanvasMouseDown = (e) => {
    if (!selectedRegion) return;

    const pos = getMousePosition(e);
    const region = regions.find(r => r.field_name === selectedRegion);
    if (!region) return;

    // Check if clicking on resize handle (bottom-right corner)
    const handleSize = 16;
    if (
      pos.x >= region.x + region.width - handleSize &&
      pos.x <= region.x + region.width &&
      pos.y >= region.y + region.height - handleSize &&
      pos.y <= region.y + region.height
    ) {
      setResizing({ region: selectedRegion, startX: pos.x, startY: pos.y });
      return;
    }

    // Check if clicking inside region
    if (
      pos.x >= region.x &&
      pos.x <= region.x + region.width &&
      pos.y >= region.y &&
      pos.y <= region.y + region.height
    ) {
      setDragging({ region: selectedRegion, offsetX: pos.x - region.x, offsetY: pos.y - region.y });
    }
  };

  const handleCanvasMouseMove = (e) => {
    const pos = getMousePosition(e);

    if (dragging) {
      const region = regions.find(r => r.field_name === dragging.region);
      if (region) {
        const newX = Math.max(0, Math.min(pos.x - dragging.offsetX, imageNaturalSize.width - region.width));
        const newY = Math.max(0, Math.min(pos.y - dragging.offsetY, imageNaturalSize.height - region.height));

        setRegions(regions.map(r =>
          r.field_name === dragging.region
            ? { ...r, x: Math.round(newX), y: Math.round(newY) }
            : r
        ));
      }
    } else if (resizing) {
      const region = regions.find(r => r.field_name === resizing.region);
      if (region) {
        const newWidth = Math.max(50, pos.x - region.x);
        const newHeight = Math.max(50, pos.y - region.y);

        setRegions(regions.map(r =>
          r.field_name === resizing.region
            ? { ...r, width: Math.round(newWidth), height: Math.round(newHeight) }
            : r
        ));
      }
    }
  };

  const handleCanvasMouseUp = () => {
    setDragging(null);
    setResizing(null);
  };

  const saveRegion = async (region) => {
    try {
      await ocrAPI.updateRegion(region.field_name, region);
      alert(`Region "${region.field_name}" saved successfully!`);
    } catch (error) {
      console.error('Error saving region:', error);
      alert('Failed to save region');
    }
  };

  const testRegionOCR = async (region) => {
    if (!testImageFile) {
      alert('Please upload a test image first');
      return;
    }

    try {
      const result = await ocrAPI.testOCR(testImageFile, region);
      setOcrResults(prev => ({
        ...prev,
        [region.field_name]: result.text
      }));
    } catch (error) {
      console.error('Error testing OCR:', error);
      setOcrResults(prev => ({
        ...prev,
        [region.field_name]: 'Error: ' + error.message
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            OCR Region Configuration
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Upload a test cover sheet, draw regions for job number and construction method, then test and save.
          </p>

          {/* Upload Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Upload Test Cover Sheet (PDF or Image)
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handleImageUpload}
              className="block w-full text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Image Viewer */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Image Viewer</h2>
            {testImage ? (
              <div className="relative">
                <img
                  ref={imageRef}
                  src={testImage}
                  alt="Test cover sheet"
                  className="w-full h-auto border border-gray-300 dark:border-gray-600"
                  onLoad={handleImageLoad}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 cursor-crosshair"
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                />
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">Upload a cover sheet to begin</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Regions</h2>

            {regions.map((region) => (
              <div
                key={region.field_name}
                className={`mb-4 p-4 border-2 rounded-lg cursor-pointer ${
                  selectedRegion === region.field_name
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                onClick={() => setSelectedRegion(region.field_name)}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {region.field_name.replace('_', ' ').toUpperCase()}
                  </h3>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>X: {region.x}px, Y: {region.y}px</div>
                  <div>Size: {region.width}x{region.height}px</div>
                </div>

                {ocrResults[region.field_name] && (
                  <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm">
                    <div className="font-semibold text-gray-700 dark:text-gray-300">OCR Result:</div>
                    <div className="text-gray-900 dark:text-white font-mono">
                      "{ocrResults[region.field_name]}"
                    </div>
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      testRegionOCR(region);
                    }}
                    className="flex-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                  >
                    Test OCR
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      saveRegion(region);
                    }}
                    className="flex-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                  >
                    Save
                  </button>
                </div>
              </div>
            ))}

            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                Instructions:
              </h4>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                <li>1. Select a region from the list</li>
                <li>2. Drag the region to position it</li>
                <li>3. Resize using the handle (bottom-right)</li>
                <li>4. Click "Test OCR" to see results</li>
                <li>5. Click "Save" to save the configuration</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OCRSettingsPage;
