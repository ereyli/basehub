import React from 'react';
import { Download, ExternalLink, RefreshCw } from 'lucide-react';

/**
 * ImagePreview component for displaying generated AI images
 * @param {Object} props - Component props
 * @param {string} props.imageData - Base64 image data
 * @param {string} props.prompt - Original prompt used
 * @param {Function} props.onRegenerate - Callback for regenerating image
 * @param {boolean} props.isGenerating - Whether image is being generated
 * @param {boolean} props.disabled - Whether component is disabled
 */
export default function ImagePreview({ 
  imageData, 
  prompt, 
  onRegenerate, 
  isGenerating, 
  disabled 
}) {
  const handleDownload = () => {
    if (!imageData) return;
    
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${imageData}`;
    link.download = `ai-nft-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewFullscreen = () => {
    if (!imageData) return;
    
    const newWindow = window.open();
    newWindow.document.write(`
      <html>
        <head>
          <title>AI Generated Image</title>
          <style>
            body { 
              margin: 0; 
              padding: 20px; 
              background: #f5f5f5; 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              min-height: 100vh;
              font-family: system-ui, -apple-system, sans-serif;
            }
            .container {
              background: rgba(15, 23, 42, 0.95);
              backdrop-filter: blur(20px);
              border-radius: 18px;
              padding: 20px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.4);
              border: 1px solid rgba(255, 255, 255, 0.06);
              max-width: 90vw;
              max-height: 90vh;
            }
            img { 
              max-width: 100%; 
              max-height: 70vh; 
              border-radius: 12px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            }
            .info {
              margin-top: 15px;
              padding: 15px;
              background: rgba(30, 41, 59, 0.6);
              border-radius: 10px;
              border: 1px solid rgba(255, 255, 255, 0.06);
            }
            .prompt {
              font-weight: 600;
              color: #e2e8f0;
              margin-bottom: 8px;
            }
            .meta {
              font-size: 14px;
              color: #64748b;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <img src="data:image/png;base64,${imageData}" alt="AI Generated Image" />
            <div class="info">
              <div class="prompt">Prompt: "${prompt}"</div>
              <div class="meta">Generated on ${new Date().toLocaleString()}</div>
            </div>
          </div>
        </body>
      </html>
    `);
  };

  if (!imageData) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="aspect-square bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">No image generated yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Enter a prompt and click Generate
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto px-4">
      <div className="relative group">
        {/* Image Container */}
        <div className="aspect-square bg-white rounded-2xl border-2 border-gray-200 overflow-hidden shadow-lg">
          <img
            src={`data:image/png;base64,${imageData}`}
            alt={`AI Generated: ${prompt}`}
            className="w-full h-full object-cover"
          />
          
          {/* Overlay Actions */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="flex gap-2">
              <button
                onClick={handleViewFullscreen}
                className="p-2 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full shadow-lg transition-all duration-200 transform hover:scale-110"
                title="View fullscreen"
              >
                <ExternalLink className="w-5 h-5 text-gray-700" />
              </button>
              
              <button
                onClick={handleDownload}
                className="p-2 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full shadow-lg transition-all duration-200 transform hover:scale-110"
                title="Download image"
              >
                <Download className="w-5 h-5 text-gray-700" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Image Info */}
        <div className="mt-4 p-4 bg-gray-50 rounded-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 mb-1">
                Generated Image
              </p>
              <p className="text-xs text-gray-600 line-clamp-2">
                "{prompt}"
              </p>
            </div>
            
            <button
              onClick={onRegenerate}
              disabled={disabled || isGenerating}
              className={`
                btn text-sm
                ${disabled || isGenerating
                  ? 'btn-disabled'
                  : 'btn-secondary'
                }
              `}
            >
              {isGenerating ? (
                <>
                  <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3" />
                  Regenerate
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
