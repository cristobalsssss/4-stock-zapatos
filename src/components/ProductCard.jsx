import React, { useState, useMemo } from 'react';
import { Eye, ShoppingBag, Check, AlertTriangle, Sparkles, Layers } from 'lucide-react';

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

  // Color seleccionado por defecto: el primero que tenga stock o el primero de la lista
  const [selectedColor, setSelectedColor] = useState(() => {
    const conStock = coloresDisponibles.find(c => {
      const varsColor = variantes.filter(v => v.color === c.color);
      return varsColor.some(v => v.stock_disponible > 0);
    });
    return conStock ? conStock.color : (coloresDisponibles[0]?.color || '');
  });

  // Filtrar variantes del color seleccionado
  const variantesDelColor = useMemo(() => {
    return variantes
      .filter(v => v.color === selectedColor)
      .sort((a, b) => Number(a.talla) - Number(b.talla));
  }, [variantes, selectedColor]);

  // Talla seleccionada dentro del color activo
  const [selectedVariantId, setSelectedVariantId] = useState(() => {
    const primeraConStock = variantesDelColor.find(v => v.stock_disponible > 0);
    return primeraConStock ? primeraConStock.id : (variantesDelColor[0]?.id || null);
  });

  // Actualizar variante seleccionada si cambia el color
  const handleSelectColor = (color) => {
    setSelectedColor(color);
    const vars = variantes.filter(v => v.color === color).sort((a, b) => Number(a.talla) - Number(b.talla));
    const conStock = vars.find(v => v.stock_disponible > 0);
    setSelectedVariantId(conStock ? conStock.id : (vars[0]?.id || null));
  };

  // Obtener la variante activa
  const activeVariant = useMemo(() => {
    return variantes.find(v => v.id === selectedVariantId) || variantesDelColor[0] || null;
  }, [variantes, selectedVariantId, variantesDelColor]);

  // Stock total de este producto
  const totalStockProducto = useMemo(() => {
    return variantes.reduce((sum, v) => sum + (v.stock_disponible || 0), 0);
  }, [variantes]);

  // Imagen activa a mostrar
  const displayImage = activeVariant?.imagen_portada_variante || product.imagen_defecto_url || null;

  // Precio a mostrar
  const precio = activeVariant ? Number(activeVariant.precio_vendedores) : (variantes[0] ? Number(variantes[0].precio_vendedores) : 0);

  const [addedAnimation, setAddedAnimation] = useState(false);

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
      imagen_url: displayImage
    });
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 1200);
  };

  return (
    <article className="group bg-white rounded-2xl border border-zinc-200/80 hover:border-zinc-300 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden">
      {/* Imagen Principal y Badges */}
      <div className="relative aspect-[4/3] bg-zinc-100 overflow-hidden flex items-center justify-center">
        {displayImage ? (
          <img
            src={displayImage}
            alt={`${product.codigo_modelo} - ${product.nombre_fantasia}`}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
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
        <div className="absolute top-3 left-3 bg-zinc-900/80 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-lg tracking-wider uppercase shadow-sm">
          {product.codigo_modelo}
        </div>

        {/* Badge Disponibilidad Global */}
        <div className="absolute top-3 right-3">
          {totalStockProducto > 0 ? (
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {totalStockProducto} {totalStockProducto === 1 ? 'par' : 'pares'}
            </span>
          ) : (
            <span className="bg-zinc-800/90 text-zinc-300 text-[11px] font-medium px-2 py-0.5 rounded-full shadow-xs">
              Agotado
            </span>
          )}
        </div>

        {/* Botón Ver Galería Flotante */}
        <button
          onClick={() => onOpenGallery(product, activeVariant)}
          className="absolute bottom-3 right-3 bg-white/90 hover:bg-white text-zinc-800 p-2 rounded-xl shadow-md hover:scale-110 active:scale-95 transition-all flex items-center gap-1.5 text-xs font-semibold backdrop-blur-sm"
          title="Ver fotos y detalles"
        >
          <Eye className="w-4 h-4 text-brand-600" />
          <span className="hidden sm:inline">Ver Galería</span>
        </button>
      </div>

      {/* Contenido de la Ficha */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Título y Material */}
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <h3 className="font-display font-bold text-base sm:text-lg text-zinc-900 tracking-tight line-clamp-1">
              {product.nombre_fantasia || `Modelo ${product.codigo_modelo}`}
            </h3>
            <span className="font-display font-extrabold text-base sm:text-lg text-brand-700 tracking-tight whitespace-nowrap">
              ${precio ? precio.toLocaleString('es-CL') : '0'}
            </span>
          </div>

          {/* Atributos: Taco, Horma, Material */}
          <p className="text-xs text-zinc-500 mb-3 line-clamp-1">
            {[product.material, product.taco_base, product.horma ? `Horma ${product.horma}` : null]
              .filter(Boolean)
              .join(' • ')}
          </p>

          {/* Selector de Color */}
          {coloresDisponibles.length > 0 && (
            <div className="mb-3">
              <span className="text-[11px] font-medium text-zinc-400 block mb-1.5 uppercase tracking-wider">
                Color: <strong className="text-zinc-700 normal-case">{selectedColor}</strong>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {coloresDisponibles.map(c => {
                  const vars = variantes.filter(v => v.color === c.color);
                  const tieneStock = vars.some(v => v.stock_disponible > 0);
                  const isSelected = selectedColor === c.color;

                  return (
                    <button
                      key={c.color}
                      onClick={() => handleSelectColor(c.color)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                        isSelected
                          ? 'border-brand-600 bg-brand-50/80 text-brand-900 font-semibold shadow-xs'
                          : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                      } ${!tieneStock ? 'opacity-50 line-through' : ''}`}
                    >
                      {c.color}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selector de Tallas para el color seleccionado */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                Tallas Disponibles:
              </span>
              {activeVariant && activeVariant.stock_disponible === 1 && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3 h-3" />
                  ¡Último par!
                </span>
              )}
            </div>

            <div className="grid grid-cols-6 gap-1.5">
              {variantesDelColor.map(v => {
                const isSelected = activeVariant?.id === v.id;
                const hayStock = v.stock_disponible > 0;
                const esUltimo = v.stock_disponible === 1;

                return (
                  <button
                    key={v.id}
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
          </div>
        </div>

        {/* Botón de Acción Principal: Reservar Par */}
        <button
          onClick={handleAdd}
          disabled={!activeVariant || activeVariant.stock_disponible <= 0}
          className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-98 shadow-sm ${
            addedAnimation
              ? 'bg-emerald-600 text-white'
              : activeVariant && activeVariant.stock_disponible > 0
              ? 'bg-gradient-to-r from-brand-700 to-brand-600 hover:from-brand-800 hover:to-brand-700 text-white shadow-brand-600/20 hover:shadow-md'
              : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
          }`}
        >
          {addedAnimation ? (
            <>
              <Check className="w-4 h-4" />
              <span>¡Agregado a la Bolsa!</span>
            </>
          ) : activeVariant && activeVariant.stock_disponible > 0 ? (
            <>
              <ShoppingBag className="w-4 h-4" />
              <span>Reservar Talla {activeVariant.talla} ({activeVariant.color})</span>
            </>
          ) : (
            <span>Sin Stock en esta Talla</span>
          )}
        </button>
      </div>
    </article>
  );
}
