import React from 'react';
import { 
  Upload, 
  Coins, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle,
  Loader2
} from 'lucide-react';

/**
 * MintButton component for minting AI NFTs
 * @param {Object} props - Component props
 * @param {Function} props.onMint - Callback when mint is clicked
 * @param {boolean} props.isMinting - Whether NFT is being minted
 * @param {boolean} props.isUploading - Whether uploading to IPFS
 * @param {boolean} props.disabled - Whether button is disabled
 * @param {string} props.mintFee - Minting fee in ETH
 * @param {Object} props.success - Success state object
 * @param {string} props.error - Error message
 */
export default function MintButton({ 
  onMint, 
  isMinting, 
  isUploading, 
  disabled, 
  mintFee,
  success,
  error 
}) {
  const getButtonState = () => {
    if (success) return 'success';
    if (error) return 'error';
    if (isMinting || isUploading) return 'loading';
    if (disabled) return 'disabled';
    return 'ready';
  };

  const buttonState = getButtonState();

  const getButtonContent = () => {
    switch (buttonState) {
      case 'success':
        return (
          <>
            <CheckCircle className="w-5 h-5" />
            Minted Successfully!
          </>
        );
      
      case 'error':
        return (
          <>
            <AlertCircle className="w-5 h-5" />
            Mint Failed
          </>
        );
      
      case 'loading':
        if (isUploading) {
          return (
            <>
              <Upload className="w-5 h-5 animate-pulse" />
              Uploading to IPFS...
            </>
          );
        }
        return (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Minting NFT...
          </>
        );
      
      default:
        return (
          <>
            <Coins className="w-5 h-5" />
            Mint as NFT
          </>
        );
    }
  };

  const getButtonStyles = () => {
    const baseStyles = "btn w-full text-lg";
    
    switch (buttonState) {
      case 'success':
        return `${baseStyles} btn-primary`;
      
      case 'error':
        return `${baseStyles} btn-primary`;
      
      case 'loading':
        return `${baseStyles} btn-primary`;
      
      case 'disabled':
        return `${baseStyles} btn-disabled`;
      
      default:
        return `${baseStyles} btn-primary`;
    }
  };

  const handleClick = () => {
    if (buttonState === 'ready') {
      onMint();
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4 px-4">
      {/* Main Mint Button */}
      <button
        onClick={handleClick}
        disabled={buttonState !== 'ready'}
        className={getButtonStyles()}
      >
        {getButtonContent()}
      </button>

      {/* Fee Information */}
      {buttonState === 'ready' && (
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Minting fee: <span className="font-semibold text-blue-600">{mintFee}</span>
            {' '}per NFT
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Total cost = {mintFee} × quantity selected above
          </p>
        </div>
      )}

      {/* Success State */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-green-800 mb-1">
                NFT Minted Successfully!
              </h4>
              <p className="text-sm text-green-700 mb-3">
                Your AI-generated NFT has been minted and added to your wallet.
              </p>
              {success.transactionHash && (
                <a
                  href={success.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-green-600 hover:text-green-700 font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  View on BaseScan
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-red-800 mb-1">
                Minting Failed
              </h4>
              <p className="text-sm text-red-700">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State Info */}
      {(isMinting || isUploading) && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Loader2 className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0 animate-spin" />
            <div className="flex-1">
              <h4 className="font-semibold text-blue-800 mb-1">
                {isUploading ? 'Uploading to IPFS...' : 'Minting NFT...'}
              </h4>
              <p className="text-sm text-blue-700">
                {isUploading 
                  ? 'Your image and metadata are being uploaded to IPFS for permanent storage.'
                  : 'Your NFT is being minted on the Base network. This may take a few moments.'
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
