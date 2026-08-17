import React, { useState, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, ShoppingBag, Check, Layers, Sparkles } from 'lucide-react';

export default function GalleryModal({ product, initialVariant, onClose, onAddToBag }) {
  if (!product) return null;

  const variantes = product.inventario_variantes || [];
  
  // Talla/Variante seleccionada en el modal
  const [selectedVariantId, setSelectedVariantId] = useState(
    initialVariant ? initialVariant.id : (variantes[0]?.id || null)
  );

  const activeVariant = useMemo(() => {
    return variantes.find(v => v.id === selectedVariantId) || variantes[0] || null;
  }, [variantes, selectedVariantId]);

  // Construir lista de imágenes para este modelo y color (Galería General)
  const allImages = useMemo(() => {
    const list = [];
    const colorActivo = activeVariant?.color;
    
    // 1. Imagen de portada de este color (de cualquier variante con este color)
    const varConFoto = variantes.find(v => v.color === colorActivo && v.imagen_portada_variante);
    if (varConFoto?.imagen_portada_variante) {
      list.push({
        url: varConFoto.imagen_portada_variante,
        label: `Foto Principal (${colorActivo})`
      });
    }

    // 2. Galería de fotos asociadas a variantes de este color
    const variantesDeEsteColor = variantes.filter(v => v.color === colorActivo);
    const addedUrls = new Set(list.map(i => i.url));

    variantesDeEsteColor.forEach(v => {
      (v.imagenes_variante || []).forEach(img => {
        if (!addedUrls.has(img.imagen_url)) {
          addedUrls.add(img.imagen_url);
          list.push({
            url: img.imagen_url,
            label: `Galería (${colorActivo})`
          });
        }
      });
    });

    // 3. Imagen general del modelo si no está en la lista
    if (product.imagen_defecto_url && !addedUrls.has(product.imagen_defecto_url)) {
      list.push({
        url: product.imagen_defecto_url,
        label: 'Foto General del Modelo'
      });
    }

    return list;
  }, [product, activeVariant, variantes]);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [addedAnimation, setAddedAnimation] = useState(false);

  const currentImage = allImages[activeImageIndex] || allImages[0] || null;

  const handlePrevImage = () => {
    setActiveImageIndex(prev => (prev > 0 ? prev - 1 : allImages.length - 1));
  };

  const handleNextImage = () => {
    setActiveImageIndex(prev => (prev < allImages.length - 1 ? prev + 1 : 0));
  };

  const handleAdd = () => {
    if (!activeVariant || activeVariant.stock_disponible <= 0) return;
    onAddToBag({
      producto_id: product.id,
      codigo_modelo: product.codigo_modelo,
      nombre_fantasia: product.nombre_fantasia,
      variante_id: activeVariant.id,
      sku: activeVariant.sku_variante,
      color: activeVariant.color,
      talla: activeVariant.talla,
      precio: Number(activeVariant.precio_vendedores),
      precio_interno: Number(activeVariant.precio_interno),
      stock_disponible: activeVariant.stock_disponible,
      imagen_url: currentImage?.url || null
    });
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 1200);
  };

  const precio = activeVariant ? Number(activeVariant.precio_vendedores) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[92vh] border border-zinc-200">
        {/* Botón Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-zinc-700 hover:text-zinc-950 flex items-center justify-center shadow-md transition-transform active:scale-95"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Visor de Imágenes - Galería General */}
        <div className="w-full md:w-1/2 bg-zinc-100 relative flex flex-col items-center justify-center min-h-[280px] sm:min-h-[380px] p-4">
          {currentImage ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={currentImage.url}
                alt={product.nombre_fantasia || product.codigo_modelo}
                className="max-h-[340px] md:max-h-[460px] w-auto object-contain rounded-xl transition-all duration-300"
              />
              
              {/* Botones de navegación si hay más de 1 imagen */}
              {allImages.length > 1 && (
                <>
                  <button
                    onClick={handlePrevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-zinc-800 flex items-center justify-center shadow-md transition-all"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleNextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-zinc-800 flex items-center justify-center shadow-md transition-all"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Indicador de fotos */}
              <div className="absolute bottom-3 left-3 bg-zinc-900/80 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">
                Foto {activeImageIndex + 1} de {allImages.length}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-zinc-400 p-8 text-center">
              <Layers className="w-12 h-12 text-zinc-300 mb-2" />
              <span className="font-semibold text-sm">Sin fotos registradas</span>
              <span className="text-xs text-zinc-400 mt-1">Cárgalas desde el Panel Admin</span>
            </div>
          )}

          {/* Miniaturas de la Galería General */}
          {allImages.length > 1 && (
            <div className="flex items-center gap-2 mt-3 overflow-x-auto max-w-full pb-1">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`w-12 h-12 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all ${
                    activeImageIndex === idx
                      ? 'border-brand-600 scale-105 shadow-sm'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ficha Técnica y Selección (Lado Derecho) */}
        <div className="w-full md:w-1/2 p-6 sm:p-8 flex flex-col justify-between overflow-y-auto">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-zinc-900 text-white text-xs font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                {product.codigo_modelo}
              </span>
              <span className="text-xs text-zinc-500 font-medium">
                SKU: {activeVariant?.sku_variante || 'N/A'}
              </span>
            </div>

            <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-zinc-900 tracking-tight mb-2">
              {product.nombre_fantasia || `Modelo ${product.codigo_modelo}`}
            </h2>

            <div className="font-display font-extrabold text-2xl text-brand-700 mb-4">
              ${precio.toLocaleString('es-CL')}
            </div>

            {/* Especificaciones de Calzado */}
            <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100 space-y-2 mb-6 text-xs text-zinc-700">
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
                <div className="flex justify-between border-t border-zinc-200/60 pt-2 mt-2">
                  <span className="text-zinc-400 font-medium">Detalle:</span>
                  <span className="font-medium text-zinc-800 text-right">{product.info_adicional}</span>
                </div>
              )}
            </div>

            {/* Selector de Variantes y Stock */}
            <div className="mb-6">
              <span className="text-xs font-bold text-zinc-700 block mb-2 uppercase tracking-wider">
                Selecciona Color y Talla:
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {variantes.map(v => {
                  const isSelected = activeVariant?.id === v.id;
                  const hayStock = v.stock_disponible > 0;
                  const esUltimo = v.stock_disponible === 1;

                  return (
                    <button
                      key={v.id}
                      onClick={() => {
                        setSelectedVariantId(v.id);
                        setActiveImageIndex(0);
                      }}
                      disabled={!hayStock}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-brand-600 bg-brand-50/70 shadow-sm ring-1 ring-brand-500'
                          : hayStock
                          ? 'border-zinc-200 hover:border-zinc-300 bg-white'
                          : 'border-zinc-100 bg-zinc-50/60 opacity-40 cursor-not-allowed line-through'
                      }`}
                    >
                      <span className="text-xs font-bold text-zinc-900">{v.color}</span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-extrabold text-brand-700">Talla {v.talla}</span>
                        {hayStock && (
                          <span className={`text-[10px] font-semibold px-1 rounded ${
                            esUltimo ? 'bg-amber-100 text-amber-800 font-bold' : 'text-emerald-700 bg-emerald-50'
                          }`}>
                            {v.stock_disponible}p
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Botón Añadir a Bolsa */}
          <button
            onClick={handleAdd}
            disabled={!activeVariant || activeVariant.stock_disponible <= 0}
            className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-98 shadow-md ${
              addedAnimation
                ? 'bg-emerald-600 text-white'
                : activeVariant && activeVariant.stock_disponible > 0
                ? 'bg-gradient-to-r from-brand-700 to-brand-600 hover:from-brand-800 hover:to-brand-700 text-white shadow-brand-600/20'
                : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
            }`}
          >
            {addedAnimation ? (
              <>
                <Check className="w-5 h-5" />
                <span>¡Agregado a la Bolsa!</span>
              </>
            ) : activeVariant && activeVariant.stock_disponible > 0 ? (
              <>
                <ShoppingBag className="w-5 h-5" />
                <span>Reservar Talla {activeVariant.talla} ({activeVariant.color})</span>
              </>
            ) : (
              <span>Sin Stock Disponible</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
