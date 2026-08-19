import React, { useState } from 'react';
import { X, Trash2, ShoppingBag, Send, Sparkles, MapPin, User, MessageSquare, Phone, Truck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { crearReserva } from '../lib/api';
import { useTiendaConfig } from '../lib/useTiendaConfig';

export default function ReservationDrawer({
  isOpen,
  onClose,
  bagItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearBag
}) {
  if (!isOpen) return null;

  const [clientName, setClientName] = useState('');
  const [clientCity, setClientCity] = useState('');
  const [clientPhone, setClientPhone] = useState('+56 9 ');
  const [clientNotes, setClientNotes] = useState('');
  const [entregaPref, setEntregaPref] = useState('Presencial Concepción/Penco');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { config } = useTiendaConfig();

  const total = bagItems.reduce((acc, item) => acc + item.precio * item.quantity, 0);
  const totalPares = bagItems.reduce((acc, item) => acc + item.quantity, 0);

  const handlePhoneChange = (e) => {
    let val = e.target.value;
    if (!val.startsWith('+56 9 ')) {
      val = '+56 9 ' + val.replace(/^\+56\s*9\s*/, '').replace(/[^0-9]/g, '');
    }
    setClientPhone(val);
  };

  const vendedoraNombre = config.nombre_vendedora || config.nombre_duena || 'Carmen';

  const handleSendWhatsApp = async () => {
    if (!clientName.trim()) {
      setErrorMsg('Por favor ingresa tu Nombre completo para la reserva.');
      return;
    }
    if (!clientCity.trim()) {
      setErrorMsg('Por favor ingresa tu Comuna o Ciudad de entrega.');
      return;
    }
    if (clientPhone.trim().length < 12) {
      setErrorMsg('Por favor ingresa un número de WhatsApp válido (+56 9 XXXX XXXX).');
      return;
    }
    if (bagItems.length === 0) {
      setErrorMsg('Tu bolsa de reserva está vacía.');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);

    try {
      // 1. Guardar primero en BD y almacenamiento blindado
      const primerItem = bagItems[0] || {};
      const reservaCreada = await crearReserva({
        cliente_nombre: clientName.trim(),
        cliente_whatsapp: clientPhone.trim(),
        cliente_comuna: clientCity.trim(),
        tipo_entrega: entregaPref,
        notas: clientNotes.trim(),
        variante_id: primerItem.variante_id || primerItem.id || null,
        modelo_codigo: primerItem.codigo_modelo || primerItem.codigo || primerItem.modelo_codigo || '',
        modelo_nombre: primerItem.nombre_fantasia || primerItem.nombre || primerItem.modelo_nombre || '',
        color: primerItem.color || '',
        talla: String(primerItem.talla || ''),
        cantidad: Number(totalPares || primerItem.cantidad || primerItem.quantity || 1),
        precio_unitario: Number(primerItem.precio_vendedores || primerItem.precio || primerItem.precio_sugerido || primerItem.precio_unitario || 0),
        items: bagItems.map(it => ({
          variante_id: it.variante_id || it.id || '',
          codigo_modelo: it.codigo_modelo || it.codigo || it.modelo_codigo || '',
          nombre_fantasia: it.nombre_fantasia || it.nombre || it.modelo_nombre || '',
          color: it.color || '',
          talla: String(it.talla || ''),
          cantidad: Number(it.quantity || it.cantidad || 1),
          precio: Number(it.precio_vendedores || it.precio || it.precio_sugerido || it.precio_unitario || 0)
        }))
      });

      const codigoRes = reservaCreada?.codigo_reserva || `RES-${Math.floor(1000 + Math.random() * 9000)}`;

      // Disparar confeti de celebración
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 }
      });

      // 2. Formatear mensaje para WhatsApp hacia el número oficial configurado
      let mensaje = `👠 *SOLICITUD DE RESERVA #${codigoRes}*\n\n`;
      mensaje += `Hola ${vendedoraNombre}, quiero reservar los siguientes pares de su catálogo boutique:\n\n`;
      mensaje += `🔖 *Código de Reserva:* #${codigoRes}\n\n`;

      bagItems.forEach((item, index) => {
        mensaje += `*${index + 1}. ${item.codigo_modelo}* - ${item.nombre_fantasia || ''}\n`;
        mensaje += `   • *Color:* ${item.color} | *Talla:* ${item.talla}\n`;
        mensaje += `   • *Cantidad:* ${item.quantity} par(es)\n`;
        mensaje += `   • *Precio:* $${(item.precio * item.quantity).toLocaleString('es-CL')}\n\n`;
      });

      mensaje += `💰 *TOTAL RESERVA:* $${total.toLocaleString('es-CL')} (${totalPares} ${totalPares === 1 ? 'par' : 'pares'})\n\n`;
      mensaje += `👤 *Cliente:* ${clientName.trim()}\n`;
      mensaje += `📱 *WhatsApp Cliente:* ${clientPhone.trim()}\n`;
      mensaje += `📍 *Comuna/Ciudad:* ${clientCity.trim()}\n`;
      mensaje += `🚚 *Modalidad:* ${entregaPref}\n`;
      if (clientNotes.trim()) {
        mensaje += `📝 *Notas:* ${clientNotes.trim()}\n`;
      }
      mensaje += `\n_Quedo atenta a la confirmación de disponibilidad y datos de pago._`;

      const cleanPhone = (config.telefono_whatsapp || '').replace(/[^0-9]/g, '');
      const encodedText = encodeURIComponent(mensaje);
      const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`;

      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

      // Limpieza total e inmediata de la bolsa de reserva
      if (onClearBag) {
        onClearBag();
      }
      try {
        localStorage.removeItem('boutique_bag_items');
      } catch (e) {
        console.error(e);
      }

      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Ocurrió un inconveniente al registrar la reserva, pero puedes enviar el WhatsApp directamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-fade-in">
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-slide-up sm:animate-fade-in border-l border-zinc-200">
        {/* Cabecera */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/80 sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-zinc-900">Bolsa de Reserva</h2>
              <span className="text-xs text-zinc-500 font-medium">{totalPares} {totalPares === 1 ? 'par seleccionado' : 'pares seleccionados'}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de Items */}
        <div className="flex-1 p-4 sm:p-5 space-y-3 overflow-y-auto">
          {bagItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center text-zinc-400">
              <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center mb-3">
                <ShoppingBag className="w-8 h-8 text-zinc-300" />
              </div>
              <p className="font-display font-bold text-zinc-800 text-base">Tu bolsa está vacía</p>
              <p className="text-xs text-zinc-400 mt-1 max-w-[200px]">
                Explora el catálogo y añade los modelos y tallas que deseas reservar.
              </p>
            </div>
          ) : (
            bagItems.map(item => (
              <div
                key={item.variante_id}
                className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 hover:border-zinc-300 transition-all"
              >
                {/* Miniatura */}
                <div className="w-16 h-16 rounded-xl bg-zinc-200 flex-shrink-0 overflow-hidden relative">
                  {item.imagen_url ? (
                    <img src={item.imagen_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-400">
                      {item.codigo_modelo}
                    </div>
                  )}
                </div>

                {/* Detalles */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-sm text-zinc-900 truncate">
                      {item.codigo_modelo}
                    </span>
                    <button
                      onClick={() => onRemoveItem(item.variante_id)}
                      className="text-zinc-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                      title="Eliminar de la bolsa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 truncate">{item.nombre_fantasia}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-semibold bg-white border border-zinc-200 px-1.5 py-0.5 rounded text-zinc-700">
                      {item.color}
                    </span>
                    <span className="text-[11px] font-bold bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded">
                      Talla {item.talla}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-extrabold text-brand-800">
                      ${(item.precio * item.quantity).toLocaleString('es-CL')}
                    </span>
                    {/* Control de cantidad */}
                    <div className="flex items-center border border-zinc-200 rounded-lg bg-white overflow-hidden text-xs">
                      <button
                        onClick={() => onUpdateQuantity(item.variante_id, Math.max(1, item.quantity - 1))}
                        className="px-2 py-0.5 hover:bg-zinc-100 font-bold text-zinc-600 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="px-2 py-0.5 font-bold text-zinc-800">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.variante_id, Math.min(item.stock_disponible, item.quantity + 1))}
                        className="px-2 py-0.5 hover:bg-zinc-100 font-bold text-zinc-600 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Formulario de Reserva y Checkout */}
        {bagItems.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-zinc-200 bg-zinc-50/90 space-y-3.5">
            {/* Total */}
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Total a Reservar:</span>
              <span className="font-display font-extrabold text-xl text-brand-800">
                ${total.toLocaleString('es-CL')}
              </span>
            </div>

            {/* Inputs del Cliente con Teléfono pre-llenado */}
            <div className="space-y-2 text-xs">
              <div className="relative">
                <User className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Tu Nombre completo *"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>

              <div className="relative">
                <Phone className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400" />
                <input
                  type="tel"
                  placeholder="Teléfono WhatsApp (+56 9 XXXX XXXX) *"
                  value={clientPhone}
                  onChange={handlePhoneChange}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono font-bold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="relative">
                <MapPin className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Comuna / Ciudad de entrega *"
                  value={clientCity}
                  onChange={e => setClientCity(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>

              {/* Selector de Modalidad */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEntregaPref('Presencial Concepción/Penco')}
                  className={`py-2 px-2 rounded-xl text-[10px] sm:text-[11px] font-bold border transition-all text-center cursor-pointer ${
                    entregaPref === 'Presencial Concepción/Penco'
                      ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                      : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  📍 Presencial (Concepción/Penco)
                </button>
                <button
                  type="button"
                  onClick={() => setEntregaPref('Envío Starken Por Pagar')}
                  className={`py-2 px-2 rounded-xl text-[10px] sm:text-[11px] font-bold border transition-all text-center cursor-pointer ${
                    entregaPref === 'Envío Starken Por Pagar'
                      ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                      : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  📦 Envío Starken (Por Pagar)
                </button>
              </div>

              <div className="relative">
                <MessageSquare className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Notas adicionales (opcional)"
                  value={clientNotes}
                  onChange={e => setClientNotes(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>
            </div>

            {/* Mensaje de Error */}
            {errorMsg && (
              <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
                {errorMsg}
              </p>
            )}

            {/* Botón WhatsApp Dinámico */}
            <button
              onClick={handleSendWhatsApp}
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Guardando Reserva...' : `Enviar Reserva a ${vendedoraNombre} por WhatsApp`}</span>
            </button>

            <button
              onClick={onClearBag}
              className="w-full text-center text-xs text-zinc-400 hover:text-zinc-600 font-medium cursor-pointer"
            >
              Vaciar bolsa
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
