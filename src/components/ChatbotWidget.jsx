import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles, ShoppingBag, ArrowRight, Bot, User, CheckCircle2 } from 'lucide-react';
import { consultarChatbot } from '../lib/api';

export default function ChatbotWidget({ products = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: '¡Hola! 👠 Soy tu Asistente Virtual de Calzado. ¿Buscas algún modelo, color o talla específica?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Estado para flujo de cierre a WhatsApp
  const [showWaForm, setShowWaForm] = useState(false);
  const [waNombre, setWaNombre] = useState('');
  const [waComuna, setWaComuna] = useState('');
  const [waModelo, setWaModelo] = useState('');

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const cleanText = inputMessage.trim();
    if (!cleanText || isLoading) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: cleanText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const botResponse = await consultarChatbot(cleanText, products);
      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: botResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: 'Disculpa, tuve un problema de conexión temporal. Puedes consultar directamente a nuestra vendedora por WhatsApp.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickQuestion = (text) => {
    setInputMessage(text);
    // Ejecutar después del render
    setTimeout(() => {
      const fakeEvent = { preventDefault: () => {} };
      setInputMessage(text);
    }, 50);
  };

  const handleSendToWhatsApp = (e) => {
    e.preventDefault();
    if (!waNombre.trim() || !waComuna.trim()) return;

    let mensajeWhatsApp = `¡Hola Stephanie! Vengo del Asistente Virtual de la tienda online.\n\n`;
    mensajeWhatsApp += `👤 *Cliente:* ${waNombre.trim()}\n`;
    mensajeWhatsApp += `📍 *Comuna/Ciudad:* ${waComuna.trim()}\n`;
    if (waModelo.trim()) {
      mensajeWhatsApp += `👟 *Calzado de Interés:* ${waModelo.trim()}\n`;
    }
    mensajeWhatsApp += `\nQuisiera confirmar stock y coordinar la compra/reserva. ¡Muchas gracias!`;

    const encodedText = encodeURIComponent(mensajeWhatsApp);
    const waUrl = `https://wa.me/56993125219?text=${encodedText}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');
    setShowWaForm(false);
    setWaNombre('');
    setWaComuna('');
    setWaModelo('');
  };

  return (
    <>
      {/* Botón Flotante de Apertura */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 bg-gradient-to-r from-zinc-900 via-brand-800 to-zinc-900 text-white p-3.5 sm:px-4 sm:py-3 rounded-full shadow-2xl hover:shadow-brand-600/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 group border border-white/20"
          title="Abrir Asistente Virtual de Stock"
        >
          <div className="relative">
            <MessageCircle className="w-6 h-6 text-brand-400 group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
          </div>
          <span className="hidden sm:inline font-bold text-xs tracking-wide">
            Consultar Asistente
          </span>
        </button>
      )}

      {/* Ventana Flotante de Chat */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[92vw] sm:w-96 max-w-sm h-[540px] max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-zinc-200 flex flex-col overflow-hidden animate-fade-in">
          {/* Cabecera del Chat */}
          <div className="bg-zinc-900 text-white p-4 flex items-center justify-between border-b border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center shadow-md">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-display font-extrabold text-sm text-white flex items-center gap-1.5">
                  <span>Asistente de Stock</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                </h4>
                <p className="text-[10px] text-zinc-400 font-medium">En línea • Consulta disponibilidad en vivo</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Área de Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50/50">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'bot' && (
                  <div className="w-7 h-7 rounded-lg bg-zinc-900 text-brand-400 flex items-center justify-center flex-shrink-0 text-xs mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-zinc-900 text-white rounded-tr-xs shadow-xs'
                      : 'bg-white text-zinc-800 border border-zinc-200/80 rounded-tl-xs shadow-xs whitespace-pre-line'
                  }`}
                >
                  <p>{msg.text}</p>
                  <span className={`block text-[9px] mt-1 text-right ${msg.sender === 'user' ? 'text-zinc-400' : 'text-zinc-400'}`}>
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2 items-center text-zinc-400 text-xs pl-2">
                <div className="w-2 h-2 rounded-full bg-brand-500 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-brand-500 animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 rounded-full bg-brand-500 animate-bounce [animation-delay:0.4s]"></div>
                <span className="text-[11px] font-medium ml-1">Consultando inventario...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Sugerencias Rápidas */}
          <div className="px-3 py-2 bg-white border-t border-zinc-100 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <button
              type="button"
              onClick={() => {
                setInputMessage('¿Qué modelos tienen en talla 37?');
              }}
              className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium whitespace-nowrap transition-colors"
            >
              👠 Talla 37
            </button>
            <button
              type="button"
              onClick={() => {
                setInputMessage('¿Tienen zapatos en color Rojo?');
              }}
              className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium whitespace-nowrap transition-colors"
            >
              ❤️ Color Rojo
            </button>
            <button
              type="button"
              onClick={() => setShowWaForm(true)}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 whitespace-nowrap transition-colors flex items-center gap-1"
            >
              💬 WhatsApp Directo
            </button>
          </div>

          {/* Formulario de Derivación a WhatsApp */}
          {showWaForm ? (
            <form onSubmit={handleSendToWhatsApp} className="p-3.5 bg-emerald-50/90 border-t border-emerald-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-900 flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Comprar / Reservar por WhatsApp</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowWaForm(false)}
                  className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Tu Nombre *"
                  value={waNombre}
                  onChange={e => setWaNombre(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs text-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                />
                <input
                  type="text"
                  required
                  placeholder="Comuna / Ciudad *"
                  value={waComuna}
                  onChange={e => setWaComuna(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs text-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <input
                type="text"
                placeholder="Modelo o talla de interés (opcional)"
                value={waModelo}
                onChange={e => setWaModelo(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs text-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
              />

              <button
                type="submit"
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-98"
              >
                <span>Abrir WhatsApp con Asesora</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            /* Input de Consulta */
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-zinc-200 flex items-center gap-2">
              <input
                type="text"
                placeholder="Escribe tu consulta de stock..."
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                disabled={isLoading}
                className="flex-1 px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white transition-all active:scale-95 shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
