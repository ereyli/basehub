import React, { useState } from 'react';
import { Sparkles, Send } from 'lucide-react';

/**
 * PromptInput component for AI NFT generation
 * @param {Object} props - Component props
 * @param {Function} props.onGenerate - Callback when generate is clicked
 * @param {boolean} props.isGenerating - Whether image is being generated
 * @param {boolean} props.disabled - Whether input is disabled
 */
export default function PromptInput({ onGenerate, isGenerating, disabled }) {
  const [prompt, setPrompt] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (prompt.trim() && !isGenerating && !disabled) {
      onGenerate(prompt.trim());
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-800">
            Describe Your AI Art
          </h3>
        </div>
        
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Enter a detailed description of the artwork you want to generate... (e.g., 'A futuristic cityscape with neon lights and flying cars at sunset')"
            disabled={disabled || isGenerating}
            className={`
              w-full h-32 px-4 py-3 pr-12 border-2 rounded-xl resize-none
              transition-all duration-200 ease-in-out
              ${isFocused 
                ? 'border-blue-500 shadow-lg shadow-blue-500/20' 
                : 'border-gray-200 hover:border-gray-300'
              }
              ${disabled || isGenerating 
                ? 'bg-gray-50 text-gray-400 cursor-not-allowed' 
                : 'bg-white text-gray-800 focus:outline-none'
              }
              placeholder-gray-400
            `}
            maxLength={500}
          />
          
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {prompt.length}/500
            </span>
            
            <button
              type="submit"
              disabled={!prompt.trim() || isGenerating || disabled}
              className={`
                btn
                ${!prompt.trim() || isGenerating || disabled
                  ? 'btn-disabled'
                  : 'btn-primary'
                }
              `}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Generate
                </>
              )}
            </button>
          </div>
        </form>
        
        <div className="mt-3 text-sm text-gray-600">
          <p className="mb-1">
            💡 <strong>Tips for better results:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Be specific about style, colors, and mood</li>
            <li>Include artistic styles like "digital art", "oil painting", "anime"</li>
            <li>Mention lighting, composition, and atmosphere</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
