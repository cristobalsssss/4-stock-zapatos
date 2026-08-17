import React from 'react';
import { Sparkles, ShieldCheck, Heart } from 'lucide-react';

export default function Footer({ onOpenAdminLogin }) {
  return (
    <footer className="bg-white border-t border-zinc-200 mt-20 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-brand-600 text-white flex items-center justify-center font-display font-bold text-xs">
            Z
          </div>
          <span className="font-semibold text-zinc-800">Boutique de Calzado Femenino</span>
          <span>• Catálogo & Gestión de Inventario en Tiempo Real</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onOpenAdminLogin}
            className="hover:text-zinc-900 transition-colors flex items-center gap-1 font-medium"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Acceso Privado</span>
          </button>
          <span>•</span>
          <span className="flex items-center gap-1">
            Diseñado para E-commerce Boutique <Sparkles className="w-3 h-3 text-brand-500" />
          </span>
        </div>
      </div>
    </footer>
  );
}
