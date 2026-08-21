import React, { useState, useMemo, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ShoppingBag, Check, Layers, ZoomIn } from 'lucide-react';
import InteractiveLightbox from './InteractiveLightbox';

export default function GalleryModal({ product, initialVariant, onClose, onAddToBag }) {
  if (!product) return null;

  const variantes = product.inventario_variantes || [];

  // Obtener colores únicos disponibles en el modelo
  const coloresDisponibles = useMemo(() => {
    const map = new Map();
    variantes.forEach(v => {
      if (!map.has(v.color)) {
        map.set(v.color, v);
      }
    });
    return Array.from(map.values());
  }, [variantes]);

  // =========================================================================
  // REGLA UX: ESTADO INICIAL NEUTRO (SIN PRESELECCIÓN SI NO SE PASÓ EXPLÍCITA)
  // =========================================================================
  const [selectedColor, setSelectedColor] = useState(
    initialVariant ? initialVariant.color : null
  );

  const [selectedVariantId, setSelectedVariantId] = useState(
    initialVariant ? initialVariant.id : null
  );

  // Variantes del color seleccionado (si hay color)
  const variantesDelColor = useMemo(() => {
    if (!selectedColor) return [];
    return variantes
      .filter(v => v.color === selectedColor)
      .sort((a, b) => Number(a.talla) - Number(b.talla));
  }, [variantes, selectedColor]);

  // Al cambiar color, resetear talla para que el usuario elija conscientemente
  const handleColorChange = (newColor) => {
    setSelectedColor(newColor);
    setSelectedVariantId(null);
    setActiveImageIndex(0);
  };

  const activeVariant = useMemo(() => {
    if (!selectedVariantId) return null;
    return variantes.find(v => v.id === selectedVariantId) || null;
  }, [variantes, selectedVariantId]);

  // =========================================================================
  // REGLA UX: FOTOS SEGÚN ESTADO (PORTADA GENERAL O ESTRICTA POR COLOR)
  // =========================================================================
  const colorImages = useMemo(() => {
    // Si no hay color seleccionado (Estado Neutro Inicial), mostrar SOLO la foto principal del modelo
    if (!selectedColor) {
      if (product.imagen_defecto_url) {
        return [{
          url: product.imagen_defecto_url,
          label: 'Foto Principal del Modelo',
          isCover: true
        }];
      }
      // Fallback a primera imagen de cualquier variante si no hay defecto_url
      const firstWithPhoto = variantes.find(v => v.imagen_portada_variante);
      if (firstWithPhoto) {
        return [{
          url: firstWithPhoto.imagen_portada_variante,
          label: 'Foto de Portada',
          isCover: true
        }];
      }
      return [];
    }

    // Si hay color seleccionado: Filtrado ESTRICTO por ese color (oculta portada general)
    const list = [];
    const addedUrls = new Set();

    // 1. Portada del color seleccionado
    const varConPortada = variantesDelColor.find(v => v.imagen_portada_variante);
    if (varConPortada?.imagen_portada_variante) {
      addedUrls.add(varConPortada.imagen_portada_variante);
      list.push({
        url: varConPortada.imagen_portada_variante,
        label: `Foto Principal - ${selectedColor}`,
        isCover: true
      });
    }

    // 2. Fotos de Galería asignadas a variantes de este color
    variantesDelColor.forEach(v => {
      (v.imagenes_variante || []).forEach(img => {
        if (!addedUrls.has(img.imagen_url)) {
          addedUrls.add(img.imagen_url);
          list.push({
            url: img.imagen_url,
            label: `Galería - ${selectedColor}`,
            isCover: false
          });
        }
      });
    });

    // 3. Fallback: Si este color no tiene fotos cargadas, usar foto por defecto del modelo
    if (list.length === 0 && product.imagen_defecto_url) {
      list.push({
        url: product.imagen_defecto_url,
        label: `Foto Referencial (${selectedColor})`,
        isCover: true,
        isFallback: true
      });
    }

    return list;
  }, [selectedColor, variantesDelColor, product.imagen_defecto_url, variantes]);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [addedAnimation, setAddedAnimation] = useState(false);

  useEffect(() => {
    if (activeImageIndex >= colorImages.length) {
      setActiveImageIndex(0);
    }
  }, [colorImages.length, activeImageIndex]);

  const currentImage = colorImages[activeImageIndex] || colorImages[0] || null;

  const handlePrevImage = (e) => {
    if (e) e.stopPropagation();
    setActiveImageIndex(prev => (prev > 0 ? prev - 1 : colorImages.length - 1));
  };

  const handleNextImage = (e) => {
    if (e) e.stopPropagation();
    setActiveImageIndex(prev => (prev < colorImages.length - 1 ? prev + 1 : 0));
  };

  const handleAdd = () => {
    if (!activeVariant || activeVariant.stock_disponible <= 0) return;
    onAddToBag({
      producto_id: product.id,
      codigo_modelo: product.codigo_modelo,
      nombre_fantasia: product.nombre_fantasia,
      variante_id: activeVariant.id,
      id: activeVariant.id,
      sku: activeVariant.sku_variante,
      color: activeVariant.color,
      talla: activeVariant.talla,
      precio: Number(activeVariant.precio_vendedores),
      precio_vendedores: Number(activeVariant.precio_vendedores),
      precio_interno: Number(activeVariant.precio_interno),
      stock_disponible: activeVariant.stock_disponible,
      imagen_url: currentImage?.url || null
    });
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 1200);
  };

  // Precio referencial o del item activo (precio_vendedores oficial)
  const precio = activeVariant 
    ? (Number(activeVariant.precio_vendedores) || Number(activeVariant.precio_interno) || 0)
    : (variantes.find(v => Number(v.precio_vendedores) > 0)?.precio_vendedores || (variantes[0] ? Number(variantes[0].precio_vendedores || variantes[0].precio_interno || 0) : 0));

  // Estado del botón de reserva
  const isReservationReady = Boolean(selectedColor && activeVariant && activeVariant.stock_disponible > 0);

  const getButtonText = () => {
    if (addedAnimation) return '¡Agregado a la Bolsa!';
    if (!selectedColor) return 'Selecciona color y talla para reservar';
    if (!selectedVariantId) return `Selecciona una talla en color ${selectedColor}`;
    if (activeVariant && activeVariant.stock_disponible <= 0) return 'Sin Stock en esta Talla';
    return `Reservar Talla ${activeVariant?.talla} (${selectedColor})`;
  };

  return (
    <>
      {/* Modal Principal de Detalle */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/75 backdrop-blur-sm animate-fade-in">
        <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[94vh] border border-zinc-200">
          {/* Botón Cerrar Modal */}
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-zinc-700 hover:text-zinc-950 flex items-center justify-center shadow-md transition-all active:scale-95 border border-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>

          {/* VISOR DE IMÁGENES MAXIMIZADO (Lado Izquierdo) */}
          <div className="w-full md:w-7/12 bg-zinc-950/5 relative flex flex-col items-center justify-between min-h-[300px] sm:min-h-[420px] md:min-h-[520px] p-2 sm:p-4 border-b md:border-b-0 md:border-r border-zinc-200 overflow-hidden">
            {/* Contenedor Principal de la Foto */}
            <div 
              onClick={() => currentImage && setIsLightboxOpen(true)}
              className="relative w-full flex-1 flex items-center justify-center cursor-zoom-in group rounded-2xl overflow-hidden bg-white/50"
            >
              {currentImage ? (
                <>
                  <img
                    src={currentImage.url}
                    alt={`${product.codigo_modelo} ${selectedColor ? `- ${selectedColor}` : ''}`}
                    className="max-h-[300px] sm:max-h-[380px] md:max-h-[440px] w-full object-contain transition-transform duration-300 group-hover:scale-103"
                  />

                  {/* Botón Lupa / Zoom Flotante */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsLightboxOpen(true);
                    }}
                    className="absolute top-3 right-3 bg-zinc-900/80 hover:bg-zinc-900 text-white p-2 rounded-xl shadow-lg backdrop-blur-md transition-all flex items-center gap-1.5 text-xs font-semibold"
                    title="Ampliar foto a pantalla completa (Deep Zoom)"
                  >
                    <ZoomIn className="w-4 h-4 text-brand-400" />
                    <span className="hidden sm:inline">Zoom</span>
                  </button>

                  {/* Badges de Estado de la Foto */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <span className="bg-zinc-900/85 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-sm">
                      {selectedColor ? `${selectedColor} • ${activeImageIndex + 1} de ${colorImages.length}` : 'Portada Principal'}
                    </span>
                    {currentImage.isFallback && (
                      <span className="bg-amber-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                        Foto Referencial
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-zinc-400 p-8 text-center">
                  <Layers className="w-12 h-12 text-zinc-300 mb-2" />
                  <span className="font-semibold text-sm text-zinc-600">Foto en preparación</span>
                  <span className="text-xs text-zinc-400 mt-1">Cárgala desde el Panel Admin</span>
                </div>
              )}

              {/* Botones de Navegación Lateral */}
              {colorImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-zinc-800 flex items-center justify-center shadow-lg transition-all active:scale-95"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-zinc-800 flex items-center justify-center shadow-lg transition-all active:scale-95"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Carrusel de Miniaturas (si hay más de 1 foto para el estado actual) */}
            {colorImages.length > 1 && (
              <div className="flex items-center gap-2 mt-2.5 overflow-x-auto max-w-full pb-1 px-1">
                {colorImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`w-14 h-14 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all bg-white ${
                      activeImageIndex === idx
                        ? 'border-brand-600 scale-105 shadow-md ring-2 ring-brand-500/20'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* FICHA TÉCNICA Y SELECCIÓN (Lado Derecho) */}
          <div className="w-full md:w-5/12 p-5 sm:p-7 flex flex-col justify-between overflow-y-auto bg-white">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="bg-zinc-900 text-white text-xs font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                    {product.codigo_modelo}
                  </span>
                  {activeVariant?.sku_variante && (
                    <span className="text-xs text-zinc-500 font-medium font-mono">
                      {activeVariant.sku_variante}
                    </span>
                  )}
                </div>

                <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-zinc-900 tracking-tight">
                  {product.nombre_fantasia || `Modelo ${product.codigo_modelo}`}
                </h2>

                <div className="font-display font-extrabold text-2xl text-brand-700 mt-1">
                  ${precio.toLocaleString('es-CL')}
                </div>
              </div>

              {/* Paso 1: Selector de Color */}
              <div>
                <span className="text-xs font-bold text-zinc-500 block mb-2 uppercase tracking-wider">
                  1. Seleccionar Color ({coloresDisponibles.length}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {coloresDisponibles.map(c => {
                    const varsColor = variantes.filter(v => v.color === c.color);
                    const conStock = varsColor.some(v => v.stock_disponible > 0);
                    const isSelected = selectedColor === c.color;

                    return (
                      <button
                        key={c.color}
                        type="button"
                        onClick={() => handleColorChange(c.color)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          isSelected
                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs ring-2 ring-brand-500/30'
                            : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border-zinc-200'
                        } ${!conStock ? 'opacity-50 line-through' : ''}`}
                      >
                        {c.color}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Paso 2: Selector de Tallas para el color seleccionado */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    {selectedColor ? `2. Seleccionar talla en color ${selectedColor}:` : '2. Talla (selecciona color primero)'}
                  </span>
                  {activeVariant && activeVariant.stock_disponible === 1 && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      ¡Último par!
                    </span>
                  )}
                </div>

                {!selectedColor ? (
                  <div className="p-3 bg-zinc-50 rounded-xl border border-dashed border-zinc-200 text-center text-xs text-zinc-400">
                    Elige un color arriba para desplegar las tallas disponibles.
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                    {variantesDelColor.map(v => {
                      const isSelected = selectedVariantId === v.id;
                      const hayStock = v.stock_disponible > 0;
                      const esUltimo = v.stock_disponible === 1;

                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVariantId(v.id)}
                          disabled={!hayStock}
                          className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                            isSelected
                              ? 'border-brand-600 bg-brand-50 text-brand-900 ring-2 ring-brand-500 font-bold shadow-xs'
                              : hayStock
                              ? esUltimo
                                ? 'border-amber-300 bg-amber-50/80 text-amber-900'
                                : 'border-zinc-200 hover:border-zinc-300 bg-white text-zinc-800 font-semibold'
                              : 'border-zinc-100 bg-zinc-50 text-zinc-300 cursor-not-allowed line-through'
                          }`}
                        >
                          <span className="text-xs">T{v.talla}</span>
                          {hayStock && (
                            <span className="text-[9px] text-zinc-500 font-normal leading-tight">
                              {v.stock_disponible}p
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Ficha Técnica Compacta */}
              <div className="bg-zinc-50 rounded-2xl p-3.5 border border-zinc-100 space-y-1.5 text-xs text-zinc-600">
                {product.categoria && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400 font-medium">Categoría:</span>
                    <span className="font-semibold text-zinc-900">{product.categoria}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-zinc-400 font-medium">Material:</span>
                  <span className="font-semibold text-zinc-900">{product.material || 'Cuero Legítimo'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400 font-medium">Taco / Base:</span>
                  <span className="font-semibold text-zinc-900">{product.taco_base || 'Normal'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400 font-medium">Horma:</span>
                  <span className="font-semibold text-zinc-900">{product.horma || 'Normal'}</span>
                </div>
                {product.info_adicional && (
                  <div className="flex justify-between border-t border-zinc-200/60 pt-1.5 mt-1.5">
                    <span className="text-zinc-400 font-medium">Detalle:</span>
                    <span className="font-medium text-zinc-800 text-right">{product.info_adicional}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Botón de Acción Añadir a la Bolsa */}
            <div className="pt-4 mt-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={handleAdd}
                disabled={!isReservationReady}
                className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-98 shadow-md ${
                  addedAnimation
                    ? 'bg-emerald-600 text-white'
                    : isReservationReady
                    ? 'bg-gradient-to-r from-brand-700 to-brand-600 hover:from-brand-800 hover:to-brand-700 text-white shadow-brand-600/20'
                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none'
                }`}
              >
                {addedAnimation ? (
                  <>
                    <Check className="w-5 h-5" />
                    <span>¡Agregado a la Bolsa!</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-5 h-5" />
                    <span>{getButtonText()}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox con Zoom Interactivo Profundo */}
      <InteractiveLightbox
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        images={colorImages}
        initialIndex={activeImageIndex}
        title={`${product.codigo_modelo} - ${product.nombre_fantasia}`}
        subtitle={selectedColor ? `Color: ${selectedColor}` : 'Portada Principal'}
      />
    </>
  );
}
