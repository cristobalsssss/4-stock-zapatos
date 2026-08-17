import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';

export default function InteractiveLightbox({
  isOpen,
  onClose,
  images = [],
  initialIndex = 0,
  title = '',
  subtitle = ''
}) {
  if (!isOpen || images.length === 0) return null;

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Touch tracking for pinch and double-tap
  const lastTouchDistRef = useRef(null);
  const lastTapRef = useRef(0);
  const containerRef = useRef(null);

  const currentImage = images[currentIndex] || images[0];

  // Reset zoom & pan when image changes
  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    resetZoom();
  }, [currentIndex, resetZoom]);

  const handlePrev = useCallback((e) => {
    if (e) e.stopPropagation();
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const handleNext = useCallback((e) => {
    if (e) e.stopPropagation();
    setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  // Zoom controls
  const zoomIn = (e) => {
    if (e) e.stopPropagation();
    setScale(prev => Math.min(4, +(prev + 0.5).toFixed(2)));
  };

  const zoomOut = (e) => {
    if (e) e.stopPropagation();
    setScale(prev => {
      const next = Math.max(1, +(prev - 0.5).toFixed(2));
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  // Mouse wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setScale(prev => {
      const next = Math.min(4, Math.max(1, +(prev + delta).toFixed(2)));
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  // Mouse drag handlers
  const handleMouseDown = (e) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers (Pinch to zoom + Double tap + Touch drag)
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      // Pinch start
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchDistRef.current = dist;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        // Double tap toggle
        setScale(prev => {
          const next = prev > 1 ? 1 : 2.5;
          if (next === 1) setPosition({ x: 0, y: 0 });
          return next;
        });
      } else {
        // Start single finger drag if zoomed
        if (scale > 1) {
          setIsDragging(true);
          setDragStart({
            x: e.touches[0].clientX - position.x,
            y: e.touches[0].clientY - position.y
          });
        }
      }
      lastTapRef.current = now;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && lastTouchDistRef.current !== null) {
      // Pinch move
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / lastTouchDistRef.current;
      setScale(prev => {
        const next = Math.min(4, Math.max(1, +(prev * factor).toFixed(2)));
        if (next === 1) setPosition({ x: 0, y: 0 });
        return next;
      });
      lastTouchDistRef.current = dist;
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      // Touch drag
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    }
  };

  const handleTouchEnd = () => {
    lastTouchDistRef.current = null;
    setIsDragging(false);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === 'ArrowRight') handleNext();
      else if (e.key === '+' || e.key === '=') zoomIn();
      else if (e.key === '-') zoomOut();
      else if (e.key === '0') resetZoom();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose, resetZoom]);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onClick={onClose}
      className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex flex-col justify-between p-3 sm:p-6 select-none animate-fade-in touch-none"
    >
      {/* Barra Superior */}
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="w-full max-w-6xl mx-auto flex items-center justify-between text-white z-20"
      >
        <div className="min-w-0 pr-4">
          <h3 className="font-display font-extrabold text-sm sm:text-lg text-white truncate">
            {title}
          </h3>
          <p className="text-xs text-zinc-400 font-medium">
            {subtitle || `Foto ${currentIndex + 1} de ${images.length}`} • Zoom actual: <strong className="text-brand-400">{scale}x</strong>
          </p>
        </div>

        {/* Toolbar de Zoom & Cierre */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Botones de Zoom flotantes */}
          <div className="flex items-center bg-zinc-900/90 border border-zinc-700/80 rounded-2xl p-1 shadow-lg backdrop-blur-md">
            <button
              type="button"
              onClick={zoomOut}
              disabled={scale <= 1}
              className="p-1.5 sm:p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-all active:scale-95"
              title="Reducir Zoom (-)"
            >
              <ZoomOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <button
              type="button"
              onClick={resetZoom}
              className="px-2 py-1 text-[11px] sm:text-xs font-bold text-brand-400 hover:text-brand-300 hover:bg-zinc-800 rounded-lg transition-all"
              title="Restablecer (1x)"
            >
              {scale}x
            </button>

            <button
              type="button"
              onClick={zoomIn}
              disabled={scale >= 4}
              className="p-1.5 sm:p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-all active:scale-95"
              title="Aumentar Zoom (+)"
            >
              <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* Botón Cerrar */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-2xl bg-zinc-900/90 border border-zinc-700/80 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all active:scale-95 shadow-lg"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>

      {/* Lienzo Principal de Imagen con Drag & Pinch Zoom */}
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`relative flex-1 w-full max-w-6xl mx-auto flex items-center justify-center overflow-hidden ${
          scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
        }`}
      >
        <div
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
            transformOrigin: 'center center'
          }}
          className="will-change-transform flex items-center justify-center max-h-full max-w-full"
        >
          <img
            src={currentImage?.url}
            alt={currentImage?.label || title}
            draggable={false}
            className="max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl pointer-events-none select-none"
          />
        </div>

        {/* Indicador de Ayuda para Arrastrar cuando hay Zoom */}
        {scale > 1 && (
          <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md text-zinc-300 text-xs font-semibold px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5 pointer-events-none animate-fade-in">
            <Move className="w-3.5 h-3.5 text-brand-400" />
            <span>Arrastra para examinar detalles</span>
          </div>
        )}

        {/* Botones de Navegación Lateral (solo si hay más de 1 foto) */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all border border-white/15 shadow-2xl active:scale-95 z-10"
              title="Foto anterior (←)"
            >
              <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all border border-white/15 shadow-2xl active:scale-95 z-10"
              title="Foto siguiente (→)"
            >
              <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>
          </>
        )}
      </div>

      {/* Carrusel de Miniaturas Inferiores */}
      {images.length > 1 && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-6xl mx-auto flex items-center justify-center gap-2 overflow-x-auto py-2 z-20"
        >
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`w-13 h-13 sm:w-15 sm:h-15 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 bg-zinc-900 ${
                currentIndex === idx
                  ? 'border-brand-500 scale-110 shadow-lg ring-2 ring-brand-500/30'
                  : 'border-transparent opacity-50 hover:opacity-100'
              }`}
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
