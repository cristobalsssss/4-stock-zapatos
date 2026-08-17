import React, { useState, useEffect, useCallback } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Move } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between items-center overflow-hidden select-none p-3 sm:p-5 animate-fade-in">
      {/* TransformWrapper configurado con límites controlados para móviles y reseteo por key */}
      <TransformWrapper
        key={currentIndex}
        initialScale={1}
        minScale={0.8}
        maxScale={4}
        centerOnInit={true}
        wheel={{ step: 0.15, disabled: false }}
        pinch={{ step: 2, disabled: false }}
        doubleClick={{ mode: 'toggle', step: 2 }}
        panning={{ disabled: false, velocityDisabled: true }}
      >
        {({ zoomIn, zoomOut, resetTransform, state }) => {
          const currentScale = +(state?.scale || 1).toFixed(1);

          return (
            <>
              {/* ========================================================= */}
              {/* CABECERA SUPERIOR Y CONTROLES                             */}
              {/* ========================================================= */}
              <div className="w-full max-w-6xl mx-auto flex items-center justify-between text-white z-50 pointer-events-none mb-1">
                <div className="min-w-0 pr-3 pointer-events-auto touch-auto">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-extrabold text-sm sm:text-base text-white truncate">
                      {title}
                    </h3>
                    <span className="hidden sm:inline-block bg-white/10 text-zinc-300 text-[10px] px-2 py-0.5 rounded-md">
                      Pellizca / Rueda | Arrastra
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-zinc-400 font-medium">
                    {subtitle || `Foto ${currentIndex + 1} de ${images.length}`} • Zoom: <strong className="text-brand-400">{currentScale}x</strong>
                  </p>
                </div>

                {/* Toolbar de Zoom & Botón Cerrar */}
                <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto touch-auto">
                  <div className="flex items-center bg-zinc-900/95 border border-zinc-700/80 rounded-2xl p-1 shadow-2xl backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => zoomOut(0.5)}
                      disabled={currentScale <= 0.8}
                      className="touch-auto pointer-events-auto z-50 p-1.5 sm:p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-all active:scale-95 cursor-pointer"
                      title="Reducir Zoom (-)"
                    >
                      <ZoomOut className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => resetTransform()}
                      className="touch-auto pointer-events-auto z-50 px-2 py-1 text-[11px] sm:text-xs font-bold text-brand-400 hover:text-brand-300 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                      title="Restablecer a 1x"
                    >
                      {currentScale}x
                    </button>

                    <button
                      type="button"
                      onClick={() => zoomIn(0.5)}
                      disabled={currentScale >= 4}
                      className="touch-auto pointer-events-auto z-50 p-1.5 sm:p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-all active:scale-95 cursor-pointer"
                      title="Aumentar Zoom (+)"
                    >
                      <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="touch-auto pointer-events-auto z-50 p-2 sm:p-2.5 rounded-2xl bg-zinc-900/95 border border-zinc-700/80 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all active:scale-95 shadow-2xl cursor-pointer"
                    title="Cerrar (Esc)"
                  >
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>

              {/* ========================================================= */}
              {/* ÁREA CENTRAL INTERACTIVA DE ZOOM & PAN (72vh CONTROLADO)  */}
              {/* ========================================================= */}
              <div className="relative w-full h-[72vh] flex items-center justify-center overflow-hidden my-auto">
                <TransformComponent
                  wrapperClass="!w-full !h-full flex items-center justify-center"
                  contentClass="flex items-center justify-center"
                >
                  <img
                    src={currentImage?.url}
                    alt={currentImage?.label || title}
                    draggable={false}
                    className="max-h-[68vh] max-w-[88vw] object-contain pointer-events-auto select-none rounded-xl shadow-2xl"
                  />
                </TransformComponent>

                {/* Indicador de Ayuda para Arrastrar si scale > 1 */}
                {currentScale > 1 && (
                  <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md text-zinc-200 text-xs font-semibold px-3 py-1.5 rounded-xl border border-white/15 flex items-center gap-1.5 pointer-events-none animate-fade-in z-40 shadow-xl">
                    <Move className="w-3.5 h-3.5 text-brand-400" />
                    <span>Arrastra para examinar</span>
                  </div>
                )}

                {/* Flechas Laterales de Navegación */}
                {images.length > 1 && (
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between px-2 sm:px-4 pointer-events-none z-50">
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="touch-auto pointer-events-auto z-50 w-10 h-10 sm:w-13 sm:h-13 rounded-2xl bg-black/70 hover:bg-black/95 text-white flex items-center justify-center transition-all border border-white/20 shadow-2xl active:scale-95 cursor-pointer"
                      title="Foto anterior (←)"
                    >
                      <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="touch-auto pointer-events-auto z-50 w-10 h-10 sm:w-13 sm:h-13 rounded-2xl bg-black/70 hover:bg-black/95 text-white flex items-center justify-center transition-all border border-white/20 shadow-2xl active:scale-95 cursor-pointer"
                      title="Foto siguiente (→)"
                    >
                      <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
                    </button>
                  </div>
                )}
              </div>

              {/* ========================================================= */}
              {/* CARRUSEL INFERIOR DE MINIATURAS                           */}
              {/* ========================================================= */}
              {images.length > 1 && (
                <div className="w-full max-w-6xl mx-auto flex items-center justify-center gap-2 overflow-x-auto py-1.5 z-50 pointer-events-none">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => changeImage(idx)}
                      className={`touch-auto pointer-events-auto z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 bg-zinc-900 cursor-pointer ${
                        currentIndex === idx
                          ? 'border-brand-500 scale-105 shadow-2xl ring-2 ring-brand-500/40'
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
