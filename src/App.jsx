import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Navbar from './components/Navbar';
import ProductCard from './components/ProductCard';
import GalleryModal from './components/GalleryModal';
import ReservationDrawer from './components/ReservationDrawer';
import AdminLoginModal from './components/AdminLoginModal';
import AdminPanel from './components/AdminPanel';
import ChatbotWidget from './components/ChatbotWidget';
import Footer from './components/Footer';
import { getCatalogFromSupabase } from './lib/api';
import { supabase } from './lib/supabase';
import { Search, SlidersHorizontal, Sparkles, AlertCircle, ShoppingBag, Layers } from 'lucide-react';

export default function App() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Vistas y Modales
  const [currentView, setCurrentView] = useState('catalog'); // 'catalog' | 'admin'
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    try {
      return sessionStorage.getItem('admin_auth') === 'true';
    } catch {
      return false;
    }
  });
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isBagOpen, setIsBagOpen] = useState(false);
  const [heroLogoError, setHeroLogoError] = useState(false);
  
  // Galería Modal
  const [galleryProduct, setGalleryProduct] = useState(null);
  const [galleryVariant, setGalleryVariant] = useState(null);

  // Bolsa de Reserva
  const [bagItems, setBagItems] = useState(() => {
    try {
      const saved = localStorage.getItem('boutique_bag_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('boutique_bag_items', JSON.stringify(bagItems));
    } catch (e) {
      console.error(e);
    }
  }, [bagItems]);

  // Filtros del Catálogo
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTalla, setFilterTalla] = useState('all');
  const [filterColor, setFilterColor] = useState('all');
  const [onlyWithStock, setOnlyWithStock] = useState(true);

  // Carga inicial del Catálogo
  const loadCatalog = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCatalogFromSupabase();
      setProducts(data);
    } catch (err) {
      console.error(err);
      setError('No se pudo cargar el inventario. Verifica la conexión a Supabase.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();

    const handleRoute = () => {
      const path = (window.location.pathname || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();
      if (path === '/admin' || hash === '#admin' || hash === '#/admin') {
        setCurrentView('admin');
      }
    };
    handleRoute();
    window.addEventListener('popstate', handleRoute);
    window.addEventListener('hashchange', handleRoute);

    // Suscripción Realtime a cambios en inventario_variantes
    const channel = supabase
      .channel('inventario-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventario_variantes' },
        (payload) => {
          console.log('Cambio en inventario detectado en tiempo real:', payload);
          loadCatalog();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('popstate', handleRoute);
      window.removeEventListener('hashchange', handleRoute);
      supabase.removeChannel(channel);
    };
  }, [loadCatalog]);

  // Manejo de la Bolsa de Reserva
  const handleAddToBag = (item) => {
    setBagItems(prev => {
      const existing = prev.find(i => i.variante_id === item.variante_id);
      if (existing) {
        return prev.map(i => 
          i.variante_id === item.variante_id
            ? { ...i, quantity: Math.min(item.stock_disponible, i.quantity + 1) }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    // Auto-apertura inmediata de la bolsa de reserva
    setIsBagOpen(true);
  };

  const handleUpdateQuantity = (varianteId, newQty) => {
    setBagItems(prev => prev.map(i => i.variante_id === varianteId ? { ...i, quantity: newQty } : i));
  };

  const handleRemoveBagItem = (varianteId) => {
    setBagItems(prev => prev.filter(i => i.variante_id !== varianteId));
  };

  const handleClearBag = () => {
    setBagItems([]);
  };

  // Abrir Galería Multi-Ángulo
  const handleOpenGallery = (product, variant) => {
    setGalleryProduct(product);
    setGalleryVariant(variant);
  };

  // Extracción de listas únicas de colores y tallas para filtros
  const { allColores, allTallas } = useMemo(() => {
    const colores = new Set();
    const tallas = new Set();

    products.forEach(p => {
      (p.inventario_variantes || []).forEach(v => {
        if (v.color) colores.add(v.color.trim());
        if (v.talla) tallas.add(Number(v.talla));
      });
    });

    return {
      allColores: Array.from(colores).sort(),
      allTallas: Array.from(tallas).sort((a, b) => a - b)
    };
  }, [products]);

  // Filtrado de productos para la vista de catálogo
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const variantes = product.inventario_variantes || [];
      
      // Filtro de Stock
      const stockTotal = variantes.reduce((acc, v) => acc + (v.stock_disponible || 0), 0);
      if (onlyWithStock && stockTotal <= 0) return false;

      // Filtro de Búsqueda de Texto (Código, Nombre Fantasía, Material, Info)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchCodigo = product.codigo_modelo.toLowerCase().includes(q);
        const matchNombre = (product.nombre_fantasia || '').toLowerCase().includes(q);
        const matchMaterial = (product.material || '').toLowerCase().includes(q);
        const matchColor = variantes.some(v => v.color.toLowerCase().includes(q));
        const matchSku = variantes.some(v => v.sku_variante.toLowerCase().includes(q));

        if (!matchCodigo && !matchNombre && !matchMaterial && !matchColor && !matchSku) {
          return false;
        }
      }

      // Filtro por Talla
      if (filterTalla !== 'all') {
        const tieneTalla = variantes.some(v => 
          Number(v.talla) === Number(filterTalla) && (!onlyWithStock || v.stock_disponible > 0)
        );
        if (!tieneTalla) return false;
      }

      // Filtro por Color
      if (filterColor !== 'all') {
        const tieneColor = variantes.some(v => 
          v.color.toLowerCase() === filterColor.toLowerCase() && (!onlyWithStock || v.stock_disponible > 0)
        );
        if (!tieneColor) return false;
      }

      return true;
    });
  }, [products, searchTerm, filterTalla, filterColor, onlyWithStock]);

  const totalParesEnBolsa = bagItems.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 font-sans">
      {/* Barra de Navegación Principal */}
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        bagCount={totalParesEnBolsa}
        setIsBagOpen={setIsBagOpen}
        isAdminAuthenticated={isAdminAuthenticated}
        setIsAdminLoginOpen={setIsAdminLoginOpen}
        onRefresh={loadCatalog}
        isLoading={isLoading}
      />

      {/* VISTA 1: CATÁLOGO PÚBLICO */}
      {currentView === 'catalog' && (
        <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6 md:py-8 space-y-3.5 sm:space-y-6 md:space-y-8 w-full">
          {/* Hero Section Móvil: Compacto, Boutique y Claro (< md) */}
          <div className="block md:hidden bg-gradient-to-r from-amber-50/80 via-white to-rose-50/70 rounded-2xl border border-zinc-200/90 py-2.5 px-3.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                {!heroLogoError ? (
                  <img 
                    src="/logo.png" 
                    alt="Tinyglam" 
                    onError={() => setHeroLogoError(true)}
                    className="h-7 sm:h-8 w-auto object-contain flex-shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-700 to-brand-500 flex items-center justify-center text-white font-display font-black text-xs flex-shrink-0 shadow-2xs">
                    T
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h1 className="font-display font-black text-sm text-zinc-900 leading-none tracking-tight">
                      Tinyglam
                    </h1>
                    <span className="text-[10px] text-zinc-400 font-medium leading-none">• Cuero Argentino</span>
                  </div>
                  <p className="text-[9.5px] text-brand-700 font-semibold tracking-wide truncate mt-0.5">
                    Calzado de Cuero Premium en Chile
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-700 border border-brand-500/20 text-[9px] font-bold whitespace-nowrap flex-shrink-0">
                <Sparkles className="w-2.5 h-2.5 text-brand-500" />
                <span>Stock Real</span>
              </span>
            </div>
          </div>

          {/* Hero Section Escritorio: Editorial y Premium (>= md) */}
          <div className="hidden md:block relative rounded-3xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 text-white p-8 lg:p-12 overflow-hidden shadow-xl border border-zinc-800">
            <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-10 bg-[radial-gradient(#fb7185_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>
            
            <div className="max-w-3xl relative z-10 space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 text-xs font-semibold tracking-wide">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tinyglam • Stock Físico en Bodega</span>
              </div>
              
              <div className="flex items-center gap-6 pt-1">
                {!heroLogoError && (
                  <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/15 inline-flex items-center justify-center max-w-[200px] shadow-md group">
                    <img 
                      src="/logo.png" 
                      alt="Tinyglam Logo" 
                      onError={() => setHeroLogoError(true)}
                      className="h-12 w-auto object-contain"
                    />
                  </div>
                )}
                <div>
                  <h1 className="font-display font-black text-4xl lg:text-5xl tracking-tight text-white leading-tight">
                    Tinyglam
                  </h1>
                  <p className="text-brand-300 text-base lg:text-lg font-bold tracking-wide mt-0.5">
                    Calzado de Cuero Premium Argentino en Chile
                  </p>
                </div>
              </div>

              <p className="text-zinc-300 text-sm font-normal max-w-xl leading-relaxed">
                Encuentra tu talla y modelo favorito en tiempo real. Añade a tu bolsa y reserva directo con nuestra vendedora oficial vía WhatsApp <strong className="text-white font-semibold underline decoration-brand-500/60 underline-offset-2">sin pago inmediato</strong>.
              </p>
            </div>
          </div>

          {/* Barra de Búsqueda y Filtros Rápidos */}
          <div className="bg-white p-3 sm:p-4 md:p-6 rounded-2xl sm:rounded-3xl border border-zinc-200 shadow-xs space-y-3 sm:space-y-4">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
              {/* Buscador de Texto */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar por código (ej: AA0002), modelo, material o color..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs sm:text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-brand-500 font-medium transition-all"
                />
              </div>

              {/* Selector de Talla */}
              <div className="flex items-center gap-2">
                <select
                  value={filterTalla}
                  onChange={e => setFilterTalla(e.target.value)}
                  className="px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs sm:text-sm font-semibold text-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                >
                  <option value="all">Todas las Tallas</option>
                  {allTallas.map(t => (
                    <option key={t} value={t}>Talla {t}</option>
                  ))}
                </select>

                {/* Selector de Color */}
                <select
                  value={filterColor}
                  onChange={e => setFilterColor(e.target.value)}
                  className="px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs sm:text-sm font-semibold text-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                >
                  <option value="all">Todos los Colores</option>
                  {allColores.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                {/* Toggle Solo con Stock */}
                <button
                  type="button"
                  onClick={() => setOnlyWithStock(!onlyWithStock)}
                  className={`px-3 py-2.5 rounded-2xl text-xs font-bold border transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    onlyWithStock
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${onlyWithStock ? 'bg-emerald-500' : 'bg-zinc-400'}`}></span>
                  <span>Solo con Stock</span>
                </button>
              </div>
            </div>

            {/* Contador de Resultados */}
            <div className="flex items-center justify-between text-xs text-zinc-500 border-t border-zinc-100 pt-3">
              <span>
                Mostrando <strong>{filteredProducts.length}</strong> de {products.length} modelos en catálogo
              </span>
              {(searchTerm || filterTalla !== 'all' || filterColor !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterTalla('all');
                    setFilterColor('all');
                    setOnlyWithStock(true);
                  }}
                  className="text-brand-600 hover:text-brand-800 font-semibold"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {/* Estado de Carga */}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-zinc-200 p-4 space-y-3 animate-pulse">
                  <div className="aspect-[4/3] bg-zinc-200 rounded-xl"></div>
                  <div className="h-4 bg-zinc-200 rounded w-2/3"></div>
                  <div className="h-3 bg-zinc-100 rounded w-1/2"></div>
                  <div className="h-8 bg-zinc-200 rounded-xl"></div>
                </div>
              ))}
            </div>
          )}

          {/* Mensaje de Error */}
          {error && (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-3xl text-center max-w-lg mx-auto space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
              <p className="text-sm font-semibold text-rose-800">{error}</p>
              <button
                onClick={loadCatalog}
                className="px-4 py-2 bg-rose-600 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                Reintentar Carga
              </button>
            </div>
          )}

          {/* Grid de Productos */}
          {!isLoading && !error && (
            filteredProducts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-zinc-200 p-8 space-y-3">
                <Layers className="w-12 h-12 text-zinc-300 mx-auto" />
                <h3 className="font-display font-bold text-lg text-zinc-800">No encontramos zapatos con esos filtros</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Prueba cambiando la talla, quitando el color o limpiando el texto de búsqueda.
                </p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterTalla('all');
                    setFilterColor('all');
                    setOnlyWithStock(false);
                  }}
                  className="px-4 py-2 bg-zinc-900 text-white text-xs font-bold rounded-xl"
                >
                  Ver Todos los Modelos
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
                {filteredProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onOpenGallery={handleOpenGallery}
                    onAddToBag={handleAddToBag}
                  />
                ))}
              </div>
            )
          )}
        </main>
      )}

      {/* VISTA 2: PANEL DE ADMINISTRACIÓN */}
      {currentView === 'admin' && (
        <AdminPanel
          products={products}
          onDataChanged={loadCatalog}
          onLogout={() => {
            try {
              sessionStorage.removeItem('admin_auth');
            } catch (e) {}
            setIsAdminAuthenticated(false);
            setCurrentView('catalog');
          }}
        />
      )}

      {/* Modal de Galería Multi-Ángulo */}
      {galleryProduct && (
        <GalleryModal
          product={galleryProduct}
          initialVariant={galleryVariant}
          onClose={() => {
            setGalleryProduct(null);
            setGalleryVariant(null);
          }}
          onAddToBag={handleAddToBag}
        />
      )}

      {/* Drawer / Bolsa de Reserva de Cliente */}
      <ReservationDrawer
        isOpen={isBagOpen}
        onClose={() => setIsBagOpen(false)}
        bagItems={bagItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveBagItem}
        onClearBag={handleClearBag}
      />

      {/* Modal de Login PIN Admin */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onLoginSuccess={() => {
          try {
            sessionStorage.setItem('admin_auth', 'true');
          } catch (e) {}
          setIsAdminAuthenticated(true);
          setCurrentView('admin');
        }}
      />

      {/* Widget Flotante de Chatbot Asistente */}
      {currentView === 'catalog' && (
        <ChatbotWidget products={products} />
      )}

      {/* Pie de Página */}
      <Footer onOpenAdminLogin={() => setIsAdminLoginOpen(true)} />
    </div>
  );
}
