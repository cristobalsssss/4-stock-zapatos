import React from 'react';
import { ShoppingBag, ShieldCheck, Sparkles, PhoneCall, RefreshCw } from 'lucide-react';

export default function Navbar({
  currentView,
  setCurrentView,
  bagCount,
  setIsBagOpen,
  isAdminAuthenticated,
  setIsAdminLoginOpen,
  onRefresh,
  isLoading
}) {
  const [logoError, setLogoError] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-zinc-200/80 transition-all">
      {/* Top micro banner */}
      <div className="bg-zinc-900 text-zinc-300 text-xs py-1.5 px-4 text-center tracking-wide font-medium flex items-center justify-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-brand-400 animate-pulse" />
        <span>Tinyglam • Calzado de Cuero Premium Argentino en Chile • Stock en Tiempo Real</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div 
          onClick={() => setCurrentView('catalog')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          {!logoError ? (
            <img 
              src="/logo.png" 
              alt="Tinyglam" 
              onError={() => setLogoError(true)}
              className="h-9 sm:h-10 md:h-11 w-auto object-contain max-w-[160px] group-hover:scale-103 transition-transform" 
            />
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-700 to-brand-500 flex items-center justify-center text-white shadow-sm shadow-brand-500/20 group-hover:scale-105 transition-transform">
                <span className="font-display font-black text-xl tracking-wider">T</span>
              </div>
              <div>
                <span className="font-display font-black text-xl text-zinc-900 tracking-tight block group-hover:text-brand-600 transition-colors leading-none">
                  Tinyglam
                </span>
                <span className="text-[10px] tracking-wide font-semibold text-brand-600 block mt-0.5">
                  Cuero Premium Argentino
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            title="Refrescar catálogo"
            className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin text-brand-600' : ''}`} />
          </button>

          {/* Admin Switch */}
          {currentView === 'catalog' ? (
            <button
              onClick={() => {
                if (isAdminAuthenticated) {
                  setCurrentView('admin');
                } else {
                  setIsAdminLoginOpen(true);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all border border-zinc-200"
            >
              <ShieldCheck className="w-4 h-4 text-zinc-500" />
              <span className="hidden sm:inline">Panel Admin</span>
            </button>
          ) : (
            <button
              onClick={() => setCurrentView('catalog')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-xl transition-all border border-brand-200"
            >
              <span>← Ver Catálogo</span>
            </button>
          )}

          {/* Bolsa de Reserva (Cart) */}
          <button
            onClick={() => setIsBagOpen(true)}
            className="relative flex items-center gap-2 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            <ShoppingBag className="w-4 h-4 text-brand-400" />
            <span className="hidden sm:inline">Bolsa de Reserva</span>
            {bagCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-[11px] font-bold flex items-center justify-center animate-bounce">
                {bagCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
