import React, { useState, useEffect, useCallback } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
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

  // Sincronizar índice inicial al abrir
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const changeImage = useCallback((newIndex) => {
    setCurrentIndex(newIndex);
  }, []);

  const handlePrev = useCallback((e) => {
    if (e) e.stopPropagation();
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const handleNext = useCallback((e) => {
    if (e) e.stopPropagation();
    setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  // Atajos de teclado para navegación y cierre
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose]);

  const currentImage = images[currentIndex] || images[0];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex flex-col justify-between p-3 sm:p-6 select-none animate-fade-in touch-none overflow-hidden"
    >
      {/* TransformWrapper con key={currentIndex} para aislamiento y reseteo total de zoom al cambiar foto */}
      <TransformWrapper
        key={currentIndex}
        initialScale={1}
        minScale={1}
        maxScale={5}
        centerOnInit={true}
        wheel={{ step: 0.25, disabled: false }}
        pinch={{ step: 5, disabled: false }}
        doubleClick={{ step: 1.5, mode: 'toggle' }}
        panning={{ disabled: false, velocityDisabled: false }}
        alignmentAnimation={{ sizeX: 0, sizeY: 0 }}
      >
        {({ zoomIn, zoomOut, resetTransform, state }) => {
          const currentScale = +(state.scale || 1).toFixed(1);

          return (
            <>
              {/* Barra Superior con Controles */}
              <div 
                onClick={(e) => e.stopPropagation()} 
                className="w-full max-w-6xl mx-auto flex items-center justify-between text-white z-30"
              >
                <div className="min-w-0 pr-4">
                  <h3 className="font-display font-extrabold text-sm sm:text-lg text-white truncate">
                    {title}
                  </h3>
                  <p className="text-xs text-zinc-400 font-medium">
                    {subtitle || `Foto ${currentIndex + 1} de ${images.length}`} • Zoom: <strong className="text-brand-400">{currentScale}x</strong>
                  </p>
                </div>

                {/* Toolbar de Zoom & Cierre */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="flex items-center bg-zinc-900/90 border border-zinc-700/80 rounded-2xl p-1 shadow-lg backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => zoomOut(0.5)}
                      disabled={currentScale <= 1}
                      className="p-1.5 sm:p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-all active:scale-95"
                      title="Reducir Zoom (-)"
                    >
                      <ZoomOut className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => resetTransform()}
                      className="px-2 py-1 text-[11px] sm:text-xs font-bold text-brand-400 hover:text-brand-300 hover:bg-zinc-800 rounded-lg transition-all"
                      title="Restablecer a 1x"
                    >
                      {currentScale}x
                    </button>

                    <button
                      type="button"
                      onClick={() => zoomIn(0.5)}
                      disabled={currentScale >= 5}
                      className="p-1.5 sm:p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-all active:scale-95"
                      title="Aumentar Zoom (+)"
                    >
                      <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>

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

              {/* Contenedor del Motor de Zoom react-zoom-pan-pinch */}
              <div 
                onClick={(e) => e.stopPropagation()}
                className="relative flex-1 w-full max-w-6xl mx-auto flex items-center justify-center overflow-hidden my-auto"
              >
                <TransformComponent
                  wrapperClass="!w-full !h-full flex items-center justify-center cursor-zoom-in"
                  contentClass="!w-full !h-full flex items-center justify-center"
                >
                  <img
                    src={currentImage?.url}
                    alt={currentImage?.label || title}
                    draggable={false}
                    className="max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl select-none mx-auto my-auto"
                  />
                </TransformComponent>

                {/* Indicador de ayuda para arrastrar si scale > 1 */}
                {currentScale > 1 && (
                  <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md text-zinc-300 text-xs font-semibold px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5 pointer-events-none animate-fade-in z-20">
                    <Move className="w-3.5 h-3.5 text-brand-400" />
                    <span>Arrastra para mover en 360°</span>
                  </div>
                )}

                {/* Botones de Navegación Lateral (Fuera del TransformComponent) */}
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all border border-white/15 shadow-2xl active:scale-95 z-20"
                      title="Foto anterior (←)"
                    >
                      <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all border border-white/15 shadow-2xl active:scale-95 z-20"
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
                  className="w-full max-w-6xl mx-auto flex items-center justify-center gap-2 overflow-x-auto py-2 z-30"
                >
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => changeImage(idx)}
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
            </>
          );
        }}
      </TransformWrapper>
    </div>
  );
}
