import React from 'react';
import ReactDOM from 'react-dom';
import { X, Download, ZoomIn, ZoomOut, ChevronRight, ChevronLeft, Maximize2 } from 'lucide-react';
import { useImageUrls } from '../../hooks/useImageUrl';

interface ImageViewerProps {
  imageUrl: string | string[];
  title?: string;
  onClose: () => void;
  initialIndex?: number;
  /** Render via portal so position:fixed escapes CSS-transform ancestors (Windows). */
  portal?: boolean;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ imageUrl, title, onClose, initialIndex = 0, portal = false }) => {
  const rawImages = Array.isArray(imageUrl) ? imageUrl : [imageUrl];
  const displayUrls = useImageUrls(rawImages); // resolve all to Blob URLs

  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
  const [zoom, setZoom] = React.useState(100);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const currentDisplayUrl = displayUrls[currentIndex] ?? null;
  const hasMultiple = rawImages.length > 1;

  const handleDownload = () => {
    if (!currentDisplayUrl) return;
    const link = document.createElement('a');
    link.href = currentDisplayUrl;
    link.download = title ? `${title}-${currentIndex + 1}.jpg` : `image-${currentIndex + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : rawImages.length - 1));
    setZoom(100);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < rawImages.length - 1 ? prev + 1 : 0));
    setZoom(100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handleNext();
    if (e.key === 'ArrowRight') handlePrevious();
    if (e.key === 'Escape') onClose();
  };

  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handleNext();
      if (e.key === 'ArrowRight') handlePrevious();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex]);

  const content = (
    <div
      className={`fixed inset-0 z-[9999] bg-black flex flex-col ${isFullscreen ? '' : 'p-0'}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setZoom(Math.max(50, zoom - 25))}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded transition-colors"
            title="کوچک‌تر"
          >
            <ZoomOut size={20} />
          </button>
          <span className="text-white font-mono text-sm min-w-[60px] text-center">{zoom}%</span>
          <button
            onClick={() => setZoom(Math.min(300, zoom + 25))}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded transition-colors"
            title="بزرگ‌تر"
          >
            <ZoomIn size={20} />
          </button>
          <button
            onClick={() => setZoom(100)}
            className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded transition-colors text-xs font-bold"
            title="اندازه اصلی"
          >
            ۱۰۰٪
          </button>
          <div className="w-px h-6 bg-neutral-700 mx-2"></div>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded transition-colors"
            title="تمام صفحه"
          >
            <Maximize2 size={20} />
          </button>
          <button
            onClick={handleDownload}
            disabled={!currentDisplayUrl}
            className="p-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded transition-colors flex items-center gap-2"
            title="دانلود"
          >
            <Download size={20} />
            <span className="text-sm font-bold">دانلود</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {hasMultiple && (
            <span className="text-white text-sm font-mono bg-neutral-800 px-3 py-1.5 rounded">
              {currentIndex + 1} / {rawImages.length}
            </span>
          )}
          <button
            onClick={onClose}
            className="p-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
            title="بستن (ESC)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Image Container */}
      <div className="flex-1 overflow-auto bg-neutral-950 relative">
        <div className="min-h-full flex items-center justify-center p-8">
          {currentDisplayUrl ? (
            <img
              src={currentDisplayUrl}
              alt={title || 'تصویر'}
              style={{
                width: zoom === 100 ? 'auto' : `${zoom}%`,
                maxWidth: zoom === 100 ? '100%' : 'none',
                maxHeight: zoom === 100 ? '100%' : 'none',
              }}
              className="object-contain"
            />
          ) : (
            <div className="text-neutral-500 text-sm animate-pulse">در حال بارگذاری...</div>
          )}
        </div>

        {/* Navigation Arrows */}
        {hasMultiple && (
          <>
            <button
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/70 hover:bg-black/90 text-white rounded-full transition-all shadow-lg"
              title="عکس قبلی (→)"
            >
              <ChevronLeft size={32} />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/70 hover:bg-black/90 text-white rounded-full transition-all shadow-lg"
              title="عکس بعدی (←)"
            >
              <ChevronRight size={32} />
            </button>
          </>
        )}
      </div>

      {/* Footer Thumbnails */}
      {(title || hasMultiple) && (
        <div className="p-3 bg-neutral-900 border-t border-neutral-800">
          <div className="flex justify-between items-center">
            {title && (
              <p className="text-white text-sm font-bold">{title}</p>
            )}
            {hasMultiple && (
              <div className="flex gap-1 overflow-x-auto max-w-md">
                {rawImages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setCurrentIndex(idx); setZoom(100); }}
                    className={`flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-all ${idx === currentIndex
                        ? 'border-blue-500 ring-2 ring-blue-500/50'
                        : 'border-neutral-700 hover:border-neutral-500'
                      }`}
                  >
                    {displayUrls[idx] ? (
                      <img src={displayUrls[idx]!} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-neutral-800 animate-pulse" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (portal) return ReactDOM.createPortal(content, document.body);
  return content;
};
