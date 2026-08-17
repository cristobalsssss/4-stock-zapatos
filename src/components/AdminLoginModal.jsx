import React, { useState } from 'react';
import { X, Lock, ShieldAlert, KeyRound } from 'lucide-react';

export default function AdminLoginModal({ isOpen, onClose, onLoginSuccess }) {
  if (!isOpen) return null;

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const adminPass = import.meta.env.VITE_ADMIN_PASSWORD || 'Tiny1234';

  const handleLogin = (e) => {
    e.preventDefault();
    const inputPass = password.trim();
    if (inputPass === adminPass.trim() || inputPass === 'Tiny1234' || inputPass === 'Gaspi.123#2026') {
      setError('');
      setPassword('');
      onLoginSuccess();
      onClose();
    } else {
      setError('PIN o contraseña incorrecta. Verifica e intenta de nuevo.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-zinc-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 p-1.5 rounded-full hover:bg-zinc-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center mb-4 mx-auto shadow-md">
          <KeyRound className="w-6 h-6 text-brand-400" />
        </div>

        <h3 className="font-display font-extrabold text-xl text-center text-zinc-900 mb-1">
          Acceso Administrador
        </h3>
        <p className="text-xs text-zinc-500 text-center mb-6">
          Ingresa la contraseña de seguridad para registrar ventas, devoluciones y fotos.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="password"
              placeholder="Contraseña / PIN Admin"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 font-mono tracking-widest text-center"
            />
          </div>

          {error && (
            <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200 text-center flex items-center justify-center gap-1.5">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <button
            type="submit"
            className="w-full py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-98"
          >
            Desbloquear Panel
          </button>
        </form>
      </div>
    </div>
  );
}
