import React, { useState, useMemo } from 'react';
import { Eye, ShoppingBag, Check, AlertTriangle, Layers, ZoomIn } from 'lucide-react';
import InteractiveLightbox from './InteractiveLightbox';

export default function ProductCard({ product, onOpenGallery, onAddToBag }) {
  const variantes = product.inventario_variantes || [];

  // Agrupar colores únicos disponibles
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
  // REGLA UX: ESTADO INICIAL NEUTRO (SIN PRESELECCIÓN POR DEFECTO)
  // =========================================================================
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [isQuickLightboxOpen, setIsQuickLightboxOpen] = useState(false);

  // Filtrar variantes del color seleccionado (si hay color)
  const variantesDelColor = useMemo(() => {
    if (!selectedColor) return [];
    return variantes
      .filter(v => v.color === selectedColor)
      .sort((a, b) => Number(a.talla) - Number(b.talla));
  }, [variantes, selectedColor]);

  // Al seleccionar color, reseteamos la talla para elección consciente
  const handleSelectColor = (color) => {
    setSelectedColor(color);
    setSelectedVariantId(null);
  };

  // Obtener la variante activa
  const activeVariant = useMemo(() => {
    if (!selectedVariantId) return null;
    return variantes.find(v => v.id === selectedVariantId) || null;
  }, [variantes, selectedVariantId]);

  // Stock total de este producto
  const totalStockProducto = useMemo(() => {
    return variantes.reduce((sum, v) => sum + (v.stock_disponible || 0), 0);
  }, [variantes]);

  // =========================================================================
  // REGLA UX: FOTO SEGÚN ESTADO (PORTADA BASE INICIAL O ESTRICTA DEL COLOR)
  // =========================================================================
  const displayImage = useMemo(() => {
    // Si no hay color seleccionado, mostrar estrictamente la portada principal base
    if (!selectedColor) {
      if (product.imagen_defecto_url) return product.imagen_defecto_url;
      const firstWithPhoto = variantes.find(v => v.imagen_portada_variante);
      return firstWithPhoto?.imagen_portada_variante || null;
    }

    // Si hay color seleccionado, buscar la portada de ese color
    const varConFoto = variantes.find(v => v.color === selectedColor && v.imagen_portada_variante);
    return varConFoto?.imagen_portada_variante || product.imagen_defecto_url || null;
  }, [selectedColor, variantes, product.imagen_defecto_url]);

  // Precio a mostrar
  const precio = activeVariant 
    ? Number(activeVariant.precio_vendedores) 
    : (variantes[0] ? Number(variantes[0].precio_vendedores) : 0);

  const [addedAnimation, setAddedAnimation] = useState(false);

  const isReservationReady = Boolean(selectedColor && activeVariant && activeVariant.stock_disponible > 0);

  const handleAdd = () => {
    if (!isReservationReady) return;
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
      imagen_url: displayImage
    });
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 1200);
  };

  const getButtonText = () => {
    if (addedAnimation) return '¡Agregado a la Bolsa!';
    if (!selectedColor) return 'Selecciona color y talla para reservar';
    if (!selectedVariantId) return `Selecciona talla en ${selectedColor}`;
    if (activeVariant && activeVariant.stock_disponible <= 0) return 'Sin Stock en esta Talla';
    return `Reservar Talla ${activeVariant?.talla} (${selectedColor})`;
  };

  return (
    <>
      <article 
        id={`product-${product.codigo_modelo}`}
        className="group bg-white rounded-3xl border border-zinc-200/80 hover:border-zinc-300 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden"
      >
        {/* Contenedor de Imagen Maximizado */}
        <div 
          onClick={() => onOpenGallery(product, activeVariant || { color: selectedColor })}
          className="relative aspect-[4/3] bg-zinc-100 overflow-hidden flex items-center justify-center cursor-pointer group/img"
        >
          {displayImage ? (
            <img
              src={displayImage}
              alt={`${product.codigo_modelo} - ${product.nombre_fantasia} ${selectedColor ? `(${selectedColor})` : ''}`}
              className="w-full h-full object-cover object-center group-hover/img:scale-106 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-zinc-400 p-4 text-center">
              <div className="w-12 h-12 rounded-full bg-zinc-200/80 flex items-center justify-center mb-2">
                <Layers className="w-6 h-6 text-zinc-500" />
              </div>
              <span className="font-display font-semibold text-xs text-zinc-600">
                {product.codigo_modelo}
              </span>
              <span className="text-[11px] text-zinc-400">Foto en preparación</span>
            </div>
          )}

          {/* Badge Código de Modelo */}
          <div className="absolute top-3 left-3 bg-zinc-900/85 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-lg tracking-wider uppercase shadow-sm">
            {product.codigo_modelo}
          </div>

          {/* Badge Disponibilidad Global */}
          <div className="absolute top-3 right-3">
            {totalStockProducto > 0 ? (
              totalStockProducto < 3 ? (
                <span className="bg-amber-500 text-white font-bold text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-md animate-pulse">
                  <Sparkles className="w-3 h-3 text-amber-200" />
                  ¡Últimas unidades!
                </span>
              ) : (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Disponible
                </span>
              )
            ) : (
              <span className="bg-zinc-800/90 text-zinc-300 text-[11px] font-medium px-2.5 py-0.5 rounded-full shadow-xs">
                Agotado
              </span>
            )}
          </div>

          {/* Botones Flotantes: Zoom Rápido y Ver Galería */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
            {displayImage && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsQuickLightboxOpen(true);
                }}
                className="bg-zinc-900/80 hover:bg-zinc-900 text-white p-2 rounded-xl shadow-md transition-all active:scale-95"
                title="Zoom rápido pantalla completa"
              >
                <ZoomIn className="w-4 h-4 text-brand-400" />
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenGallery(product, activeVariant || { color: selectedColor });
              }}
              className="bg-white/90 hover:bg-white text-zinc-800 p-2 rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 text-xs font-semibold backdrop-blur-sm border border-zinc-200"
              title="Ver ficha y galería"
            >
              <Eye className="w-4 h-4 text-brand-600" />
              <span className="hidden sm:inline">Ver Galería</span>
            </button>
          </div>
        </div>

        {/* Contenido de la Ficha */}
        <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
          <div>
            {/* Título y Precio */}
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <h3 
                onClick={() => onOpenGallery(product, activeVariant || { color: selectedColor })}
                className="font-display font-bold text-base sm:text-lg text-zinc-900 tracking-tight line-clamp-1 cursor-pointer hover:text-brand-600 transition-colors"
              >
                {product.nombre_fantasia || `Modelo ${product.codigo_modelo}`}
              </h3>
              <span className="font-display font-extrabold text-base sm:text-lg text-brand-700 tracking-tight whitespace-nowrap">
                ${precio ? precio.toLocaleString('es-CL') : '0'}
              </span>
            </div>

            {/* Atributos: Categoría, Material, Taco, Horma */}
            <p className="text-xs text-zinc-500 mb-3 line-clamp-1">
              {[product.categoria, product.material, product.taco_base, product.horma ? `Horma ${product.horma}` : null]
                .filter(Boolean)
                .join(' • ')}
            </p>

            {/* Paso 1: Selector de Color */}
            {coloresDisponibles.length > 0 && (
              <div className="mb-3">
                <span className="text-[11px] font-medium text-zinc-400 block mb-1.5 uppercase tracking-wider">
                  Color: {selectedColor ? <strong className="text-zinc-800 normal-case">{selectedColor}</strong> : <span className="text-zinc-400 font-normal italic">Elige una opción</span>}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {coloresDisponibles.map(c => {
                    const vars = variantes.filter(v => v.color === c.color);
                    const tieneStock = vars.some(v => v.stock_disponible > 0);
                    const isSelected = selectedColor === c.color;

                    return (
                      <button
                        key={c.color}
                        type="button"
                        onClick={() => handleSelectColor(c.color)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                            : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                        } ${!tieneStock ? 'opacity-40 line-through' : ''}`}
                      >
                        {c.color}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Paso 2: Selector de Tallas para el color seleccionado */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  {selectedColor ? `2. Seleccionar talla en color ${selectedColor}:` : '2. Talla (selecciona color primero)'}
                </span>
                {activeVariant && activeVariant.stock_disponible === 1 && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse border border-amber-200">
                    <AlertTriangle className="w-3 h-3" />
                    ¡Último par!
                  </span>
                )}
              </div>

              {!selectedColor ? (
                <div className="p-2.5 bg-zinc-50 rounded-xl border border-dashed border-zinc-200 text-center text-[11px] text-zinc-400">
                  Selecciona un color arriba para ver tallas
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-1.5">
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
                        className={`h-9 flex flex-col items-center justify-center rounded-xl text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-zinc-900 text-white shadow-sm scale-102 ring-2 ring-brand-500 ring-offset-1'
                            : hayStock
                            ? esUltimo
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
                            : 'bg-zinc-100/60 text-zinc-300 border border-dashed border-zinc-200 cursor-not-allowed line-through'
                        }`}
                      >
                        <span>{v.talla}</span>
                        {hayStock && (
                          <span className={`text-[8px] font-normal leading-none ${isSelected ? 'text-brand-300' : 'text-zinc-500'}`}>
                            {v.stock_disponible}p
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Botón de Acción Principal: Reservar Par (Deshabilitado si no hay selección completa) */}
          <button
            type="button"
            onClick={handleAdd}
            disabled={!isReservationReady}
            className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-98 shadow-sm ${
              addedAnimation
                ? 'bg-emerald-600 text-white'
                : isReservationReady
                ? 'bg-gradient-to-r from-brand-700 to-brand-600 hover:from-brand-800 hover:to-brand-700 text-white shadow-brand-600/20 hover:shadow-md'
                : 'bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none'
            }`}
          >
            {addedAnimation ? (
              <>
                <Check className="w-4 h-4" />
                <span>¡Agregado a la Bolsa!</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-4 h-4" />
                <span>{getButtonText()}</span>
              </>
            )}
          </button>
        </div>
      </article>

      {/* Lightbox Directo desde Tarjeta */}
      {isQuickLightboxOpen && displayImage && (
        <InteractiveLightbox
          isOpen={isQuickLightboxOpen}
          onClose={() => setIsQuickLightboxOpen(false)}
          images={[{ url: displayImage, label: `${product.codigo_modelo} ${selectedColor ? `(${selectedColor})` : ''}` }]}
          initialIndex={0}
          title={`${product.codigo_modelo} - ${product.nombre_fantasia}`}
          subtitle={selectedColor ? `Color: ${selectedColor}` : 'Portada Principal'}
        />
      )}
    </>
  );
}
