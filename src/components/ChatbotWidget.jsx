import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageCircle, 
  X, 
  Send, 
  Bot, 
  ShoppingBag, 
  ArrowRight, 
  Eye, 
  Phone, 
  MapPin, 
  ChevronDown,
  Sparkles,
  Tag,
  CheckCircle2
} from 'lucide-react';
import { consultarChatbot, crearReserva } from '../lib/api';
import { useTiendaConfig } from '../lib/useTiendaConfig';

export default function ChatbotWidget({ products = [], onSelectProduct }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationContext, setConversationContext] = useState({});
  const { config } = useTiendaConfig();

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: '¡Hola! 👠 Soy tu Asistente Virtual de Calzado.\nNuestros modelos son 100% cuero genuino a precios de liquidación de bodega. ¿Qué modelo, color o talla estás buscando hoy?',
      tarjetas: [],
      visibleLimit: 4,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Formulario de Reserva Embebido con Preview
  const [reservaActivaItem, setReservaActivaItem] = useState(null);
  const [showWaForm, setShowWaForm] = useState(false);
  const [waNombre, setWaNombre] = useState('');
  const [waPhone, setWaPhone] = useState('+56 9 ');
  const [waComuna, setWaComuna] = useState('');
  const [waEntrega, setWaEntrega] = useState('Presencial Concepción/Penco');
  const [isSubmittingReserva, setIsSubmittingReserva] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, reservaActivaItem, showWaForm]);

  const handlePhoneChange = (e) => {
    let val = e.target.value;
    if (!val.startsWith('+56 9 ')) {
      val = '+56 9 ' + val.replace(/^\+56\s*9\s*/, '').replace(/[^0-9]/g, '');
    }
    setWaPhone(val);
  };

  const handleSendMessage = async (customText = null) => {
    const cleanText = (customText || inputMessage).trim();
    if (!cleanText || isLoading) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: cleanText,
      tarjetas: [],
      visibleLimit: 4,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const botResponse = await consultarChatbot(cleanText, products, conversationContext);
      
      // Actualizar memoria conversacional contextual
      if (botResponse.nuevoContexto) {
        setConversationContext(botResponse.nuevoContexto);
      }

      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: botResponse.text,
        tarjetas: botResponse.tarjetasSugeridas || [],
        visibleLimit: 4,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error('Error en chatbot:', err);
      const vendedora = config.nombre_vendedora || config.nombre_duena || 'Vendedora';
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: `Disculpa, tuve un inconveniente de conexión. Puedes contactar directamente a ${vendedora} por WhatsApp.`,
          tarjetas: [],
          visibleLimit: 4,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerMasTarjetas = (messageId) => {
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        return { ...m, visibleLimit: (m.visibleLimit || 4) + 4 };
      }
      return m;
    }));
  };

  const handleModelClick = (codigo) => {
    const cardEl = document.getElementById(`product-${codigo}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      cardEl.classList.add('ring-4', 'ring-brand-500', 'transition-all');
      setTimeout(() => {
        cardEl.classList.remove('ring-4', 'ring-brand-500');
      }, 2500);
    }
    if (onSelectProduct) {
      const prod = products.find(p => p.codigo_modelo === codigo);
      if (prod) onSelectProduct(prod);
    }
  };

  const handleIniciarReservaCard = (cardItem) => {
    setReservaActivaItem(cardItem);
    setShowWaForm(true);
  };

  const handleSendToWhatsApp = async (e) => {
    e.preventDefault();
    if (!waNombre.trim() || !waComuna.trim()) return;
    if (waPhone.trim().length < 12) return;

    setIsSubmittingReserva(true);

    try {
      const vendedora = config.nombre_vendedora || config.nombre_duena || 'Vendedora';

      // 1. Guardar primero en BD y almacenamiento local generando #RES-XXXX
      const reservaCreada = await crearReserva({
        cliente_nombre: waNombre.trim(),
        cliente_whatsapp: waPhone.trim(),
        cliente_comuna: waComuna.trim(),
        tipo_entrega: waEntrega,
        variante_id: reservaActivaItem?.variante_id || null,
        modelo_codigo: reservaActivaItem?.codigo || 'Consulta General',
        modelo_nombre: reservaActivaItem?.nombre || '',
        color: reservaActivaItem?.color || '',
        talla: reservaActivaItem?.talla || '',
        cantidad: 1,
        precio_unitario: reservaActivaItem?.precio || 0,
        notas: 'Reserva vía Asistente Virtual',
        items: reservaActivaItem ? [{
          variante_id: reservaActivaItem.variante_id || '',
          codigo_modelo: reservaActivaItem.codigo || '',
          nombre_fantasia: reservaActivaItem.nombre || '',
          color: reservaActivaItem.color || '',
          talla: reservaActivaItem.talla ? String(reservaActivaItem.talla) : '',
          cantidad: 1,
          precio: Number(reservaActivaItem.precio || 0)
        }] : []
      });

      const codigoRes = reservaCreada.codigo_reserva || `RES-${Math.floor(1000 + Math.random() * 9000)}`;

      // 2. Construir mensaje estructurado para WhatsApp con Código de Reserva
      let mensajeWhatsApp = `👠 *SOLICITUD DE RESERVA #${codigoRes}*\n\n`;
      mensajeWhatsApp += `¡Hola ${vendedora}! Vengo del Asistente Virtual de la tienda online.\n\n`;
      mensajeWhatsApp += `🔖 *Código Reserva:* #${codigoRes}\n`;
      mensajeWhatsApp += `👤 *Cliente:* ${waNombre.trim()}\n`;
      mensajeWhatsApp += `📱 *WhatsApp:* ${waPhone.trim()}\n`;
      mensajeWhatsApp += `📍 *Comuna/Ciudad:* ${waComuna.trim()}\n`;
      mensajeWhatsApp += `🚚 *Modalidad:* ${waEntrega}\n\n`;

      if (reservaActivaItem) {
        mensajeWhatsApp += `👟 *Calzado Solicitado:* ${reservaActivaItem.codigo} - ${reservaActivaItem.nombre}\n`;
        mensajeWhatsApp += `   • Color: ${reservaActivaItem.color} | Talla: ${reservaActivaItem.talla}\n`;
        mensajeWhatsApp += `   • Precio Remate: $${Number(reservaActivaItem.precio).toLocaleString('es-CL')}\n\n`;
      }

      mensajeWhatsApp += `Quisiera confirmar la reserva y coordinar la entrega. ¡Muchas gracias!`;

      const cleanPhone = (config.telefono_whatsapp || '').replace(/[^0-9]/g, '');
      const encodedText = encodeURIComponent(mensajeWhatsApp);
      const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`;

      window.open(waUrl, '_blank', 'noopener,noreferrer');

      // 3. Confirmación en el chat con Código de Reserva
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          {
            id: Date.now() + 2,
            sender: 'bot',
            text: `🎉 ¡Excelente, ${waNombre.trim()}! Tu solicitud de reserva #${codigoRes} para ${reservaActivaItem ? `${reservaActivaItem.codigo} (${reservaActivaItem.color} T${reservaActivaItem.talla})` : 'el calzado'} ha sido registrada en el sistema y enviada a ${vendedora} por WhatsApp.`,
            tarjetas: [],
            visibleLimit: 4,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setShowWaForm(false);
        setReservaActivaItem(null);
        setWaNombre('');
        setWaPhone('+56 9 ');
        setWaComuna('');
        setConversationContext({}); // Limpiar contexto post-reserva
      }, 1000);

    } catch (err) {
      console.error('Error al procesar reserva en chatbot:', err);
    } finally {
      setIsSubmittingReserva(false);
    }
  };

  const vendedoraNombre = config.nombre_vendedora || config.nombre_duena || 'Vendedora';

  return (
    <>
      {/* Botón Flotante de Apertura */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 bg-gradient-to-r from-zinc-900 via-brand-800 to-zinc-900 text-white p-3.5 sm:px-4 sm:py-3 rounded-full shadow-2xl hover:shadow-brand-600/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 group border border-white/20 cursor-pointer"
          title="Abrir Asistente Virtual de Stock"
        >
          <div className="relative">
            <MessageCircle className="w-6 h-6 text-brand-400 group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
          </div>
          <span className="hidden sm:inline font-bold text-xs tracking-wide">
            Consultar Stock
          </span>
        </button>
      )}

      {/* Ventana Flotante de Chat */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[94vw] sm:w-[410px] max-w-sm h-[600px] max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-zinc-200 flex flex-col overflow-hidden animate-fade-in">
          {/* Cabecera del Chat */}
          <div className="bg-zinc-900 text-white p-4 flex items-center justify-between border-b border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center shadow-md">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-display font-extrabold text-sm text-white flex items-center gap-1.5">
                  <span>Asistente de Calzado</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                </h4>
                <p className="text-[10px] text-zinc-400 font-medium">100% Cuero • Precios de Bodega</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Área de Mensajes y Tarjetas Visuales */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-zinc-50/50">
            {messages.map(msg => {
              const visibleCards = (msg.tarjetas || []).slice(0, msg.visibleLimit || 4);
              const totalCards = (msg.tarjetas || []).length;
              const hasMoreCards = totalCards > visibleCards.length;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-2 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className={`flex gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.sender === 'bot' && (
                      <div className="w-7 h-7 rounded-lg bg-zinc-900 text-brand-400 flex items-center justify-center flex-shrink-0 text-xs mt-1">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[88%] p-3 rounded-2xl text-xs leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-zinc-900 text-white rounded-tr-xs shadow-xs'
                          : 'bg-white text-zinc-800 border border-zinc-200/80 rounded-tl-xs shadow-xs whitespace-pre-line'
                      }`}
                    >
                      <p>{msg.text}</p>
                      <span className="block text-[9px] mt-1 text-right text-zinc-400">
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>

                  {/* Render de Tarjetas Visuales con Paginación */}
                  {visibleCards.length > 0 && (
                    <div className="w-full pl-8 space-y-2 my-1">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        Mostrando {visibleCards.length} de {totalCards} calzados disponibles
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {visibleCards.map((card, idx) => (
                          <div
                            key={idx}
                            className="bg-white p-2.5 rounded-2xl border border-zinc-200 shadow-xs hover:shadow-md transition-all flex items-center gap-3"
                          >
                            {/* Miniatura Foto */}
                            <div className="w-14 h-14 rounded-xl bg-zinc-100 flex-shrink-0 overflow-hidden relative">
                              {card.imagen_url ? (
                                <img src={card.imagen_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-zinc-400">
                                  {card.codigo}
                                </div>
                              )}
                            </div>

                            {/* Detalles */}
                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center justify-between">
                                <span className="font-display font-bold text-xs text-zinc-900 truncate">
                                  {card.codigo}
                                </span>
                                <span className="font-extrabold text-xs text-brand-800">
                                  ${card.precio ? Number(card.precio).toLocaleString('es-CL') : ''}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-500 truncate">{card.nombre}</p>

                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[10px] font-semibold bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-700">
                                  {card.color}
                                </span>
                                <span className="text-[10px] font-bold bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded">
                                  Talla {card.talla}
                                </span>
                              </div>

                              {/* Acciones */}
                              <div className="flex items-center gap-1.5 mt-2">
                                <button
                                  type="button"
                                  onClick={() => handleModelClick(card.codigo)}
                                  className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                  title="Ver en catálogo"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Catálogo</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleIniciarReservaCard(card)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                                >
                                  <ShoppingBag className="w-3 h-3" />
                                  <span>Reservar</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Botón Ver Más */}
                      {hasMoreCards && (
                        <button
                          type="button"
                          onClick={() => handleVerMasTarjetas(msg.id)}
                          className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>✨ Ver {Math.min(4, totalCards - visibleCards.length)} modelos más</span>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-2 items-center text-zinc-400 text-xs pl-2">
                <div className="w-2 h-2 rounded-full bg-brand-500 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-brand-500 animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 rounded-full bg-brand-500 animate-bounce [animation-delay:0.4s]"></div>
                <span className="text-[11px] font-medium ml-1">Buscando en bodega con memoria contextual...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chips Rápidos */}
          <div className="px-3 py-2 bg-white border-t border-zinc-100 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <button
              type="button"
              onClick={() => handleSendMessage('35')}
              className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold whitespace-nowrap transition-colors cursor-pointer"
            >
              👠 35
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('36')}
              className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold whitespace-nowrap transition-colors cursor-pointer"
            >
              👠 36
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('37')}
              className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold whitespace-nowrap transition-colors cursor-pointer"
            >
              👠 37
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('38')}
              className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold whitespace-nowrap transition-colors cursor-pointer"
            >
              👠 38
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('¿Cómo funcionan los envíos?')}
              className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium whitespace-nowrap transition-colors cursor-pointer"
            >
              🚚 Envíos
            </button>
          </div>

          {/* Formulario Embebido de Reserva con PREVIEW VISUAL */}
          {showWaForm ? (
            <form onSubmit={handleSendToWhatsApp} className="p-3.5 bg-emerald-50/95 border-t border-emerald-200 space-y-2.5 max-h-[290px] overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-900 flex items-center gap-1">
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Confirmar Solicitud de Reserva</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowWaForm(false);
                    setReservaActivaItem(null);
                  }}
                  className="text-emerald-700 hover:text-emerald-900 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Mini Preview Visual de Calzado */}
              {reservaActivaItem && (
                <div className="bg-white p-2 rounded-xl border border-emerald-300/80 flex items-center gap-2.5 shadow-xs">
                  <div className="w-11 h-11 rounded-lg bg-zinc-100 overflow-hidden flex-shrink-0">
                    {reservaActivaItem.imagen_url ? (
                      <img src={reservaActivaItem.imagen_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-zinc-400">
                        {reservaActivaItem.codigo}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <strong className="text-xs text-zinc-900 truncate">
                        {reservaActivaItem.codigo} {reservaActivaItem.nombre ? `- ${reservaActivaItem.nombre}` : ''}
                      </strong>
                      <span className="text-xs font-extrabold text-emerald-800">
                        ${Number(reservaActivaItem.precio).toLocaleString('es-CL')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-zinc-600">
                      <span className="bg-zinc-100 px-1.5 py-0.2 rounded font-semibold text-zinc-800">
                        {reservaActivaItem.color}
                      </span>
                      <span className="bg-brand-50 text-brand-700 px-1.5 py-0.2 rounded font-bold">
                        Talla {reservaActivaItem.talla}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Tu Nombre completo *"
                  value={waNombre}
                  onChange={e => setWaNombre(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs text-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 font-medium"
                />
                <input
                  type="tel"
                  required
                  placeholder="WhatsApp *"
                  value={waPhone}
                  onChange={handlePhoneChange}
                  className="px-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs font-mono font-bold text-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Comuna / Ciudad *"
                  value={waComuna}
                  onChange={e => setWaComuna(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs text-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 font-medium"
                />
                <select
                  value={waEntrega}
                  onChange={e => setWaEntrega(e.target.value)}
                  className="px-2 py-1.5 bg-white border border-emerald-300 rounded-xl text-[10px] font-bold text-zinc-800"
                >
                  <option value="Presencial Concepción/Penco">Presencial (Conce/Penco)</option>
                  <option value="Envío Starken Por Pagar">Starken (Por Pagar)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmittingReserva}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
              >
                <span>{isSubmittingReserva ? 'Guardando Reserva...' : `Enviar Reserva a ${vendedoraNombre} por WhatsApp`}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            /* Input de Consulta */
            <form onSubmit={e => { e.preventDefault(); handleSendMessage(); }} className="p-3 bg-white border-t border-zinc-200 flex items-center gap-2">
              <input
                type="text"
                placeholder="Ej: 'Zapatos negros', '35', 'Menos de 40 mil'..."
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                disabled={isLoading}
                className="flex-1 px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 font-medium"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white transition-all active:scale-95 shadow-sm cursor-pointer"
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
