import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  RotateCcw, 
  UploadCloud, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Calendar, 
  User, 
  CreditCard, 
  Layers, 
  DollarSign, 
  ImageIcon,
  Search,
  RefreshCw,
  History,
  FileText,
  Filter,
  Settings,
  ClipboardList,
  Phone,
  Truck,
  MapPin,
  Check,
  Ban,
  ArrowRight
} from 'lucide-react';
import { 
  registrarVenta, 
  registrarDevolucion, 
  subirImagenStorage, 
  actualizarImagenModelo, 
  eliminarImagenModelo,
  actualizarImagenColor, 
  eliminarImagenColor,
  agregarImagenGaleriaColor,
  eliminarImagenGaleria,
  getDetalleMovimientos,
  getConfiguracion,
  guardarConfiguracion,
  getReservas,
  actualizarEstadoReserva,
  purgarDatosPruebaFrontend
} from '../lib/api';

export default function AdminPanel({ products, onDataChanged }) {
  const [activeTab, setActiveTab] = useState('ventas'); // 'ventas' | 'reservas' | 'movimientos' | 'devoluciones' | 'imagenes' | 'parametros' | 'alertas'

  // KPIs
  const totalModelos = products.length;
  const allVariants = useMemo(() => {
    return products.flatMap(p => 
      (p.inventario_variantes || []).map(v => ({
        ...v,
        codigo_modelo: p.codigo_modelo,
        nombre_fantasia: p.nombre_fantasia,
        producto_id: p.id,
        imagen_defecto_url: p.imagen_defecto_url
      }))
    );
  }, [products]);

  const totalUnidades = useMemo(() => {
    return allVariants.reduce((sum, v) => sum + (v.stock_disponible || 0), 0);
  }, [allVariants]);

  const variantesCriticas = useMemo(() => {
    return allVariants.filter(v => v.stock_disponible <= (v.stock_minimo_alerta || 2));
  }, [allVariants]);

  const variantesConStock = useMemo(() => {
    return allVariants.filter(v => v.stock_disponible > 0);
  }, [allVariants]);

  // =========================================================================
  // ESTADO PARA TAB 1: VENTA MULTI-PRODUCTO (DUEÑA: CARMEN)
  // =========================================================================
  const [vendedor, setVendedor] = useState('Carmen (Dueña Directa)');
  const [medioPago, setMedioPago] = useState('Transferencia');
  const [fechaVenta, setFechaVenta] = useState(new Date().toISOString().split('T')[0]);
  const [notasVenta, setNotasVenta] = useState('');
  const [selectedVariantToAdd, setSelectedVariantToAdd] = useState('');
  const [saleItems, setSaleItems] = useState([]);
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [saleResult, setSaleResult] = useState(null);
  const [convertingReservaId, setConvertingReservaId] = useState(null);
  const [isPurgingData, setIsPurgingData] = useState(false);
  const [purgeStatusMsg, setPurgeStatusMsg] = useState(null);

  const handleAddVariantToSale = () => {
    if (!selectedVariantToAdd) return;
    const v = allVariants.find(item => item.id === selectedVariantToAdd);
    if (!v || v.stock_disponible <= 0) return;

    const existing = saleItems.find(item => item.variante_id === v.id);
    if (existing) {
      if (existing.cantidad < v.stock_disponible) {
        setSaleItems(prev => prev.map(item => 
          item.variante_id === v.id ? { ...item, cantidad: item.cantidad + 1 } : item
        ));
      }
    } else {
      const precioVenta = Number(v.precio_vendedores);
      const precioInterno = Number(v.precio_interno);
      setSaleItems(prev => [
        ...prev,
        {
          variante_id: v.id,
          codigo_modelo: v.codigo_modelo,
          nombre_fantasia: v.nombre_fantasia,
          color: v.color,
          talla: v.talla,
          sku: v.sku_variante,
          stock_disponible: v.stock_disponible,
          precio_unitario: precioVenta,
          precio_interno: precioInterno,
          cantidad: 1
        }
      ]);
    }
    setSelectedVariantToAdd('');
  };

  const handleUpdateSaleItemQty = (varId, newQty) => {
    setSaleItems(prev => prev.map(item => {
      if (item.variante_id === varId) {
        const qtyValida = Math.max(1, Math.min(item.stock_disponible, newQty));
        return { ...item, cantidad: qtyValida };
      }
      return item;
    }));
  };

  const handleUpdateSaleItemPrice = (varId, newPrice) => {
    setSaleItems(prev => prev.map(item => {
      if (item.variante_id === varId) {
        return { ...item, precio_unitario: Math.max(0, Number(newPrice) || 0) };
      }
      return item;
    }));
  };

  const handleRemoveSaleItem = (varId) => {
    setSaleItems(prev => prev.filter(item => item.variante_id !== varId));
  };

  const totalMontoVenta = saleItems.reduce((acc, item) => acc + (item.precio_unitario * item.cantidad), 0);
  const totalComisionVenta = saleItems.reduce((acc, item) => {
    if (vendedor.toLowerCase().includes('admin') || vendedor.toLowerCase().includes('dueño') || vendedor.toLowerCase().includes('carmen')) {
      return acc + 0;
    }
    const delta = Math.max(0, item.precio_unitario - item.precio_interno);
    return acc + (delta * item.cantidad);
  }, 0);

  const handleExecuteMultiSale = async () => {
    if (saleItems.length === 0) return;
    setIsProcessingSale(true);
    setSaleResult(null);

    try {
      for (const item of saleItems) {
        const comisionItem = (vendedor.toLowerCase().includes('admin') || vendedor.toLowerCase().includes('dueño') || vendedor.toLowerCase().includes('carmen'))
          ? 0
          : Math.max(0, (item.precio_unitario - item.precio_interno) * item.cantidad);

        await registrarVenta({
          variante_id: item.variante_id,
          cantidad: item.cantidad,
          vendedor,
          medio_pago: medioPago,
          precio_aplicado: item.precio_unitario,
          comision_vendedor: comisionItem,
          notas: notasVenta || `Venta (${vendedor})`,
          fecha_venta: new Date(fechaVenta).toISOString()
        });
      }

      // Si la venta provenía de una reserva activa, marcarla como Completada de forma atómica
      if (convertingReservaId) {
        await actualizarEstadoReserva(convertingReservaId, 'Completada');
        setConvertingReservaId(null);
      }

      setSaleResult({
        success: true,
        message: `¡Venta de ${saleItems.length} producto(s) procesada con éxito y stock actualizado!`
      });
      setSaleItems([]);
      setNotasVenta('');
      if (onDataChanged) onDataChanged();
      loadMovimientos();
      loadReservas();
    } catch (err) {
      console.error(err);
      setSaleResult({
        success: false,
        message: `Error al procesar la venta: ${err.message}`
      });
    } finally {
      setIsProcessingSale(false);
    }
  };

  // =========================================================================
  // ESTADO PARA TAB 2: GESTIÓN DE RESERVAS DE CLIENTES
  // =========================================================================
  const [reservas, setReservas] = useState([]);
  const [isLoadingReservas, setIsLoadingReservas] = useState(false);
  const [reservaSearch, setReservaSearch] = useState('');
  const [reservaFilterEstado, setReservaFilterEstado] = useState('todos');

  const loadReservas = async () => {
    setIsLoadingReservas(true);
    try {
      const data = await getReservas();
      setReservas(data || []);
    } catch (err) {
      console.error('Error al cargar reservas:', err);
    } finally {
      setIsLoadingReservas(false);
    }
  };

  useEffect(() => {
    loadReservas();
    const handleReservasEvent = () => loadReservas();
    window.addEventListener('reservas_updated', handleReservasEvent);
    return () => window.removeEventListener('reservas_updated', handleReservasEvent);
  }, []);

  const handleCambiarEstadoReserva = async (reservaId, nuevoEstado) => {
    try {
      await actualizarEstadoReserva(reservaId, nuevoEstado);
      loadReservas();
    } catch (err) {
      console.error(err);
    }
  };

  const handleConvertirReservaAVenta = (reserva) => {
    // 1. Guardar ID de la reserva en conversión pendiente (se completará SOLO al confirmar la venta)
    setConvertingReservaId(reserva.id);

    // 2. Cargar items de la reserva al tab de ventas
    const itemsCargados = [];
    if (reserva.items && reserva.items.length > 0) {
      reserva.items.forEach(it => {
        const v = allVariants.find(vItem => vItem.id === it.variante_id || (vItem.codigo_modelo === it.codigo_modelo && vItem.color === it.color && String(vItem.talla) === String(it.talla)));
        if (v) {
          itemsCargados.push({
            variante_id: v.id,
            codigo_modelo: v.codigo_modelo,
            nombre_fantasia: v.nombre_fantasia,
            color: v.color,
            talla: v.talla,
            sku: v.sku_variante,
            stock_disponible: v.stock_disponible,
            precio_unitario: Number(it.precio) || Number(v.precio_vendedores),
            precio_interno: Number(v.precio_interno),
            cantidad: it.quantity || 1
          });
        }
      });
    } else if (reserva.variante_id || reserva.modelo_codigo) {
      const v = allVariants.find(vItem => vItem.id === reserva.variante_id || (vItem.codigo_modelo === reserva.modelo_codigo && (!reserva.color || vItem.color === reserva.color) && (!reserva.talla || String(vItem.talla) === String(reserva.talla))));
      if (v) {
        itemsCargados.push({
          variante_id: v.id,
          codigo_modelo: v.codigo_modelo,
          nombre_fantasia: v.nombre_fantasia,
          color: v.color,
          talla: v.talla,
          sku: v.sku_variante,
          stock_disponible: v.stock_disponible,
          precio_unitario: Number(reserva.precio_unitario) || Number(v.precio_vendedores),
          precio_interno: Number(v.precio_interno),
          cantidad: Number(reserva.cantidad) || 1
        });
      }
    }

    if (itemsCargados.length > 0) {
      setSaleItems(itemsCargados);
    }
    const codRes = reserva.codigo_reserva ? `#${reserva.codigo_reserva} ` : '';
    setNotasVenta(`Reserva ${codRes}de ${reserva.cliente_nombre} (${reserva.cliente_comuna || 'Concepción'}). ${reserva.tipo_entrega || ''}. ${reserva.notas || ''}`);
    setActiveTab('ventas');
  };

  const handlePurgarDatosPrueba = async () => {
    const confirm = window.confirm(
      "⚠️ ¿Estás seguro de purgar todos los datos de prueba de Reservas, Ventas y Movimientos?\n\nEl catálogo base de productos, variantes y configuración se mantendrá 100% blindado e intacto."
    );
    if (!confirm) return;

    setIsPurgingData(true);
    setPurgeStatusMsg(null);
    try {
      const res = await purgarDatosPruebaFrontend();
      setPurgeStatusMsg(res.message);
      loadReservas();
      loadMovimientos();
      if (onDataChanged) onDataChanged();
      setTimeout(() => setPurgeStatusMsg(null), 5000);
    } catch (err) {
      console.error(err);
      setPurgeStatusMsg('Error al purgar datos: ' + err.message);
    } finally {
      setIsPurgingData(false);
    }
  };

  const filteredReservas = useMemo(() => {
    return reservas.filter(r => {
      if (reservaFilterEstado !== 'todos' && r.estado !== reservaFilterEstado) return false;
      if (!reservaSearch.trim()) return true;
      const q = reservaSearch.toLowerCase();
      const nom = (r.cliente_nombre || '').toLowerCase();
      const com = (r.cliente_comuna || '').toLowerCase();
      const tel = (r.cliente_whatsapp || '').toLowerCase();
      const not = (r.notas || '').toLowerCase();
      return nom.includes(q) || com.includes(q) || tel.includes(q) || not.includes(q);
    });
  }, [reservas, reservaFilterEstado, reservaSearch]);

  // =========================================================================
  // ESTADO PARA TAB 3: DETALLE DE MOVIMIENTOS KARDEX
  // =========================================================================
  const [movimientos, setMovimientos] = useState([]);
  const [isLoadingMovimientos, setIsLoadingMovimientos] = useState(false);
  const [movSearch, setMovSearch] = useState('');
  const [movFilterTipo, setMovFilterTipo] = useState('todos');

  const loadMovimientos = async () => {
    setIsLoadingMovimientos(true);
    try {
      const data = await getDetalleMovimientos();
      setMovimientos(data || []);
    } catch (err) {
      console.error('Error al cargar movimientos:', err);
    } finally {
      setIsLoadingMovimientos(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'movimientos') {
      loadMovimientos();
    }
  }, [activeTab]);

  const filteredMovimientos = useMemo(() => {
    return movimientos.filter(m => {
      if (movFilterTipo !== 'todos') {
        const t = (m.tipo_movimiento || '').toLowerCase();
        if (!t.includes(movFilterTipo.toLowerCase())) return false;
      }
      if (!movSearch.trim()) return true;
      const q = movSearch.toLowerCase();
      const prod = m.inventario_variantes?.productos;
      const cod = (prod?.codigo_modelo || '').toLowerCase();
      const nom = (prod?.nombre_fantasia || '').toLowerCase();
      const col = (m.inventario_variantes?.color || '').toLowerCase();
      const tal = String(m.inventario_variantes?.talla || '');
      const vend = (m.ventas?.vendedor || '').toLowerCase();
      const not = (m.notas || '').toLowerCase();

      return cod.includes(q) || nom.includes(q) || col.includes(q) || tal.includes(q) || vend.includes(q) || not.includes(q);
    });
  }, [movimientos, movFilterTipo, movSearch]);

  // ==========================================
  // ESTADO PARA TAB 4: DEVOLUCIONES
  // ==========================================
  const [devVariantId, setDevVariantId] = useState('');
  const [devCantidad, setDevCantidad] = useState(1);
  const [devMotivo, setDevMotivo] = useState('Cambio de talla');
  const [devVentaId, setDevVentaId] = useState('');
  const [isProcessingDev, setIsProcessingDev] = useState(false);
  const [devResult, setDevResult] = useState(null);

  const handleExecuteDevolucion = async (e) => {
    e.preventDefault();
    if (!devVariantId) return;
    setIsProcessingDev(true);
    setDevResult(null);

    try {
      const res = await registrarDevolucion({
        variante_id: devVariantId,
        cantidad: parseInt(devCantidad, 10) || 1,
        motivo: devMotivo,
        venta_id: devVentaId.trim() || null
      });

      setDevResult({
        success: true,
        message: `Devolución exitosa. Nuevo stock disponible: ${res.stock_disponible}`
      });
      setDevVariantId('');
      setDevCantidad(1);
      setDevMotivo('Cambio de talla');
      setDevVentaId('');
      if (onDataChanged) onDataChanged();
      loadMovimientos();
    } catch (err) {
      console.error(err);
      setDevResult({
        success: false,
        message: `Error al registrar devolución: ${err.message}`
      });
    } finally {
      setIsProcessingDev(false);
    }
  };

  // ==========================================================
  // ESTADO PARA TAB 5: GESTOR DE FOTOS POR MODELO Y COLOR
  // ==========================================================
  const [uploadTargetType, setUploadTargetType] = useState('color');
  const [selectedModelId, setSelectedModelId] = useState(() => products[0]?.id || '');
  const [selectedColorName, setSelectedColorName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [deletingImageId, setDeletingImageId] = useState(null);

  const currentSelectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedModelId) || products[0] || null;
  }, [products, selectedModelId]);

  const availableColorsForModel = useMemo(() => {
    if (!currentSelectedProduct) return [];
    const setColores = new Set();
    (currentSelectedProduct.inventario_variantes || []).forEach(v => {
      if (v.color) setColores.add(v.color.trim());
    });
    return Array.from(setColores);
  }, [currentSelectedProduct]);

  useEffect(() => {
    if (availableColorsForModel.length > 0 && (!selectedColorName || !availableColorsForModel.includes(selectedColorName))) {
      setSelectedColorName(availableColorsForModel[0]);
    }
  }, [availableColorsForModel, selectedColorName]);

  const existingImagesForCurrentSelection = useMemo(() => {
    if (!currentSelectedProduct) return [];
    const list = [];

    if (currentSelectedProduct.imagen_defecto_url) {
      list.push({
        id: `modelo-${currentSelectedProduct.id}`,
        type: 'modelo',
        title: 'Foto Principal del Modelo',
        subtitle: currentSelectedProduct.codigo_modelo,
        url: currentSelectedProduct.imagen_defecto_url,
        canDelete: true,
        deleteAction: () => eliminarImagenModelo(currentSelectedProduct.id)
      });
    }

    const variantes = currentSelectedProduct.inventario_variantes || [];
    const portadasPorColor = new Map();

    variantes.forEach(v => {
      if (v.imagen_portada_variante && !portadasPorColor.has(v.color)) {
        portadasPorColor.set(v.color, v.imagen_portada_variante);
      }
    });

    portadasPorColor.forEach((imgUrl, colorName) => {
      list.push({
        id: `color-${currentSelectedProduct.id}-${colorName}`,
        type: 'color',
        title: `Portada Color: ${colorName}`,
        subtitle: `Aplica a todas las tallas ${colorName}`,
        url: imgUrl,
        canDelete: true,
        deleteAction: () => eliminarImagenColor(currentSelectedProduct.id, colorName)
      });
    });

    const galeriaMap = new Map();
    variantes.forEach(v => {
      (v.imagenes_variante || []).forEach(g => {
        if (!galeriaMap.has(g.id)) {
          galeriaMap.set(g.id, {
            id: g.id,
            type: 'galeria',
            title: `Galería General (${v.color})`,
            subtitle: 'Foto adicional',
            url: g.imagen_url,
            canDelete: true,
            deleteAction: () => eliminarImagenGaleria(g.id)
          });
        }
      });
    });

    galeriaMap.forEach(item => list.push(item));
    return list;
  }, [currentSelectedProduct]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
      setUploadStatus(null);
    }
  };

  const handleExecuteUpload = async () => {
    if (!selectedFile || !currentSelectedProduct) return;
    setIsUploading(true);
    setUploadStatus(null);

    try {
      const publicUrl = await subirImagenStorage(selectedFile, uploadTargetType);

      if (uploadTargetType === 'modelo') {
        await actualizarImagenModelo(currentSelectedProduct.id, publicUrl);
      } else if (uploadTargetType === 'color') {
        if (!selectedColorName) throw new Error('Debes seleccionar un color');
        await actualizarImagenColor(currentSelectedProduct.id, selectedColorName, publicUrl);
      } else if (uploadTargetType === 'galeria') {
        if (!selectedColorName) throw new Error('Debes seleccionar un color');
        await agregarImagenGaleriaColor(currentSelectedProduct.id, selectedColorName, publicUrl);
      }

      setUploadStatus({
        success: true,
        message: `¡Imagen subida y vinculada con éxito!`
      });
      setSelectedFile(null);
      setFilePreview(null);
      if (onDataChanged) onDataChanged();
    } catch (err) {
      console.error(err);
      setUploadStatus({
        success: false,
        message: `Error al subir imagen: ${err.message}`
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteImage = async (item) => {
    if (!window.confirm(`¿Estás seguro de eliminar esta imagen (${item.title})?`)) return;
    setDeletingImageId(item.id);
    try {
      await item.deleteAction();
      setUploadStatus({
        success: true,
        message: `Imagen eliminada correctamente.`
      });
      if (onDataChanged) onDataChanged();
    } catch (err) {
      console.error(err);
      setUploadStatus({
        success: false,
        message: `Error al eliminar la imagen: ${err.message}`
      });
    } finally {
      setDeletingImageId(null);
    }
  };

  // =========================================================================
  // ESTADO PARA TAB 6: ⚙️ PARÁMETROS DINÁMICOS Y CONFIGURACIÓN
  // =========================================================================
  const [configParams, setConfigParams] = useState({
    telefono_whatsapp: '+56900000000',
    nombre_vendedora: 'Carmen',
    modalidad_tienda: 'Venta 100% online, sin tienda física abierta al público. Precios de remate y liquidación de bodega hasta agotar stock.',
    entregas_locales: 'Entregas presenciales en Concepción y Penco (a coordinar con Carmen).',
    envios_nacionales: 'Envíos por Starken a todo Chile en modalidad "Por Pagar".'
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configStatusMsg, setConfigStatusMsg] = useState(null);

  useEffect(() => {
    getConfiguracion().then(data => setConfigParams(data));
  }, []);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setConfigStatusMsg(null);
    try {
      await guardarConfiguracion(configParams);
      setConfigStatusMsg({ success: true, text: '¡Configuración guardada exitosamente!' });
    } catch (err) {
      console.error(err);
      setConfigStatusMsg({ success: false, text: `Error al guardar: ${err.message}` });
    } finally {
      setIsSavingConfig(false);
    }
  };

  // ==========================================
  // TAB 7: BÚSQUEDA EN ALERTAS
  // ==========================================
  const [alertSearch, setAlertSearch] = useState('');
  const filteredAlerts = useMemo(() => {
    if (!alertSearch.trim()) return variantesCriticas;
    const q = alertSearch.toLowerCase();
    return variantesCriticas.filter(v => 
      v.codigo_modelo.toLowerCase().includes(q) ||
      (v.nombre_fantasia || '').toLowerCase().includes(q) ||
      v.color.toLowerCase().includes(q) ||
      v.sku_variante.toLowerCase().includes(q)
    );
  }, [variantesCriticas, alertSearch]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Cabecera del Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <span className="text-xs font-bold text-brand-700 uppercase tracking-wider bg-brand-50 px-2.5 py-1 rounded-md">
            Consola de Gestión
          </span>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-zinc-900 tracking-tight mt-1">
            Panel de Operaciones & Inventario
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Gestión de ventas, reservas de clientes, kardex de movimientos, parámetros y fotografías.
          </p>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Modelos Únicos</span>
            <Layers className="w-4 h-4 text-zinc-600" />
          </div>
          <div className="font-display font-extrabold text-2xl sm:text-3xl text-zinc-900">
            {totalModelos}
          </div>
          <span className="text-[11px] text-zinc-400">84 fichas activas</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Pares en Bodega</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-display font-extrabold text-2xl sm:text-3xl text-emerald-700">
            {totalUnidades}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">Unidades disponibles</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Reservas Activas</span>
            <ClipboardList className="w-4 h-4 text-amber-600" />
          </div>
          <div className="font-display font-extrabold text-2xl sm:text-3xl text-amber-700">
            {reservas.filter(r => r.estado === 'Pendiente').length}
          </div>
          <span className="text-[11px] text-zinc-400">pendientes de entrega</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Alertas Stock</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="font-display font-extrabold text-2xl sm:text-3xl text-rose-700">
            {variantesCriticas.length}
          </div>
          <span className="text-[11px] text-rose-600 font-medium">0 o &lt;= 2 pares</span>
        </div>
      </div>

      {/* TABS DE NAVEGACIÓN */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('ventas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'ventas'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
          }`}
        >
          <DollarSign className="w-4 h-4 text-brand-400" />
          <span>Ventas Multi-Producto</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reservas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'reservas'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
          }`}
        >
          <ClipboardList className="w-4 h-4 text-amber-400" />
          <span>Reservas ({reservas.filter(r => r.estado === 'Pendiente').length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('movimientos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'movimientos'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
          }`}
        >
          <History className="w-4 h-4 text-indigo-400" />
          <span>Detalle de Movimientos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('devoluciones')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'devoluciones'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
          }`}
        >
          <RotateCcw className="w-4 h-4 text-rose-400" />
          <span>Devoluciones</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('imagenes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'imagenes'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
          }`}
        >
          <UploadCloud className="w-4 h-4 text-teal-400" />
          <span>Gestor de Fotos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('parametros')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'parametros'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
          }`}
        >
          <Settings className="w-4 h-4 text-zinc-400" />
          <span>Parámetros & WhatsApp</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('alertas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'alertas'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>Stock Crítico ({variantesCriticas.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: TERMINAL DE VENTAS MULTI-PRODUCTO (CON PRECIO LIBRE Y CARMEN)      */}
      {/* ========================================================================= */}
      {activeTab === 'ventas' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Columna Izquierda: Configuración de la Venta */}
          <div className="lg:col-span-2 space-y-6">
            {convertingReservaId && (
              <div className="p-3.5 bg-brand-50 border border-brand-200 rounded-2xl flex items-center justify-between text-xs text-brand-900 font-medium animate-fade-in shadow-2xs">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  <span>Convirtiendo Solicitud de Reserva activa. Al confirmar la venta, la reserva pasará a <strong>Completada</strong>.</span>
                </span>
                <button
                  type="button"
                  onClick={() => setConvertingReservaId(null)}
                  className="text-xs font-bold text-brand-700 hover:text-brand-900 underline ml-2 cursor-pointer whitespace-nowrap"
                >
                  Desvincular
                </button>
              </div>
            )}

            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-zinc-200 shadow-xs space-y-5">
              <h3 className="font-display font-bold text-lg text-zinc-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand-600" />
                <span>Agregar Calzado a la Transacción</span>
              </h3>

              {/* Selector de Variante */}
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedVariantToAdd}
                  onChange={e => setSelectedVariantToAdd(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm text-zinc-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                >
                  <option value="">-- Seleccionar Modelo / Color / Talla con Stock --</option>
                  {variantesConStock.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.codigo_modelo} - {v.nombre_fantasia} | {v.color} | Talla {v.talla} (Stock: {v.stock_disponible}p) - Sugerido: ${Number(v.precio_vendedores).toLocaleString('es-CL')}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleAddVariantToSale}
                  disabled={!selectedVariantToAdd}
                  className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  + Agregar Par
                </button>
              </div>

              {/* Tabla de Items en la Venta con Monto Real Editable */}
              <div className="border border-zinc-200 rounded-2xl overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[550px]">
                  <thead className="bg-zinc-50 text-zinc-500 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-200">
                    <tr>
                      <th className="p-3">Calzado</th>
                      <th className="p-3">Color/Talla</th>
                      <th className="p-3">Monto Real / Cobrado ($)</th>
                      <th className="p-3">Cant.</th>
                      <th className="p-3">Subtotal</th>
                      <th className="p-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {saleItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-zinc-400 font-medium">
                          No hay calzados agregados a esta venta todavía.
                        </td>
                      </tr>
                    ) : (
                      saleItems.map(item => (
                        <tr key={item.variante_id} className="hover:bg-zinc-50/50">
                          <td className="p-3 font-bold text-zinc-900">
                            {item.codigo_modelo}
                            <span className="block text-[11px] font-normal text-zinc-500">{item.nombre_fantasia}</span>
                          </td>
                          <td className="p-3 text-zinc-700">
                            {item.color} - <strong className="text-brand-800 font-bold">T{item.talla}</strong>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <span className="text-zinc-400 font-semibold">$</span>
                              <input
                                type="number"
                                min="0"
                                step="500"
                                value={item.precio_unitario}
                                onChange={e => handleUpdateSaleItemPrice(item.variante_id, e.target.value)}
                                className="w-24 px-2 py-1 bg-white border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 text-right focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
                                title="Editar monto cobrado por unidad (para liquidaciones o promociones)"
                              />
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateSaleItemQty(item.variante_id, item.cantidad - 1)}
                                className="w-6 h-6 rounded bg-zinc-100 hover:bg-zinc-200 font-bold text-zinc-700 flex items-center justify-center cursor-pointer"
                              >
                                -
                              </button>
                              <span className="w-6 text-center font-bold">{item.cantidad}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateSaleItemQty(item.variante_id, item.cantidad + 1)}
                                className="w-6 h-6 rounded bg-zinc-100 hover:bg-zinc-200 font-bold text-zinc-700 flex items-center justify-center cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="p-3 font-extrabold text-brand-700">
                            ${(item.precio_unitario * item.cantidad).toLocaleString('es-CL')}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveSaleItem(item.variante_id)}
                              className="text-zinc-400 hover:text-rose-600 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Parámetros y Liquidación */}
          <div className="space-y-6">
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-zinc-200 shadow-xs space-y-4">
              <h3 className="font-display font-bold text-base text-zinc-900 border-b border-zinc-100 pb-3">
                Datos de la Venta
              </h3>

              {/* Fecha */}
              <div>
                <label className="text-xs font-bold text-zinc-500 block mb-1 uppercase tracking-wider">
                  Fecha de Operación:
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
                  <input
                    type="date"
                    value={fechaVenta}
                    onChange={e => setFechaVenta(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm font-semibold text-zinc-800"
                  />
                </div>
              </div>

              {/* Vendedor (Nombre Dueña: Carmen) */}
              <div>
                <label className="text-xs font-bold text-zinc-500 block mb-1 uppercase tracking-wider">
                  Vendedor / Canal:
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
                  <select
                    value={vendedor}
                    onChange={e => setVendedor(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm font-semibold text-zinc-800"
                  >
                    <option value="admin_carmen">Carmen (Dueña / Venta Directa $0 Com)</option>
                    <option value="camila">Camila (Vendedora Externa)</option>
                    <option value="valentina">Valentina (Vendedora Externa)</option>
                    <option value="catalina">Catalina (Vendedora Externa)</option>
                  </select>
                </div>
              </div>

              {/* Medio de Pago */}
              <div>
                <label className="text-xs font-bold text-zinc-500 block mb-1 uppercase tracking-wider">
                  Medio de Pago:
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
                  <select
                    value={medioPago}
                    onChange={e => setMedioPago(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm font-semibold text-zinc-800"
                  >
                    <option value="Transferencia">Transferencia Bancaria</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Débito">Tarjeta Débito (POS)</option>
                    <option value="Crédito">Tarjeta Crédito</option>
                  </select>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="text-xs font-bold text-zinc-500 block mb-1 uppercase tracking-wider">
                  Notas / Observación:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Cliente retira en Concepción..."
                  value={notasVenta}
                  onChange={e => setNotasVenta(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 font-medium"
                />
              </div>

              {/* Totales y Comisión en Vivo */}
              <div className="bg-zinc-900 text-white rounded-2xl p-4 space-y-2 mt-4">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Pares Totales:</span>
                  <span className="font-bold text-white">
                    {saleItems.reduce((acc, item) => acc + item.cantidad, 0)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Comisión Vendedor:</span>
                  <span className="font-bold text-brand-400">
                    ${totalComisionVenta.toLocaleString('es-CL')}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-zinc-800 font-extrabold text-white">
                  <span>Monto Total:</span>
                  <span className="text-emerald-400 text-base">
                    ${totalMontoVenta.toLocaleString('es-CL')}
                  </span>
                </div>
              </div>

              {/* Resultado de la Venta */}
              {saleResult && (
                <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  saleResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {saleResult.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
                  <span>{saleResult.message}</span>
                </div>
              )}

              {/* Botón Ejecutar Venta */}
              <button
                type="button"
                onClick={handleExecuteMultiSale}
                disabled={saleItems.length === 0 || isProcessingSale}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-md transition-all active:scale-98 cursor-pointer"
              >
                {isProcessingSale ? 'Procesando Venta y Stock...' : 'Confirmar Venta y Descontar Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: 📋 GESTIÓN DE RESERVAS DE CLIENTES (CICLO DE VIDA)                  */}
      {/* ========================================================================= */}
      {activeTab === 'reservas' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200 shadow-xs space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
            <div>
              <h3 className="font-display font-bold text-lg text-zinc-900 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-amber-600" />
                <span>Gestión de Reservas de Clientes</span>
              </h3>
              <p className="text-xs text-zinc-500">
                Control de solicitudes originadas en la Bolsa de Reserva y el Asistente Chatbot.
              </p>
            </div>

            <button
              type="button"
              onClick={loadReservas}
              disabled={isLoadingReservas}
              className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingReservas ? 'animate-spin' : ''}`} />
              <span>Refrescar</span>
            </button>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono WhatsApp, comuna o notas..."
                value={reservaSearch}
                onChange={e => setReservaSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 font-medium"
              />
            </div>

            <select
              value={reservaFilterEstado}
              onChange={e => setReservaFilterEstado(e.target.value)}
              className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800"
            >
              <option value="todos">Todos los Estados ({reservas.length})</option>
              <option value="Pendiente">Solo Pendientes</option>
              <option value="Completada">Solo Completadas</option>
              <option value="Cancelada">Solo Canceladas</option>
            </select>
          </div>

          {/* Tabla de Reservas */}
          <div className="border border-zinc-200 rounded-2xl overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[850px]">
              <thead className="bg-zinc-50 text-zinc-500 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-200">
                <tr>
                  <th className="p-3">Código</th>
                  <th className="p-3">Fecha / Hora</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">WhatsApp</th>
                  <th className="p-3">Comuna</th>
                  <th className="p-3">Pares / Detalles</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {isLoadingReservas ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-zinc-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-600 mb-2" />
                      <span>Cargando reservas...</span>
                    </td>
                  </tr>
                ) : filteredReservas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-zinc-400 font-medium">
                      No hay solicitudes de reserva registradas con esos filtros.
                    </td>
                  </tr>
                ) : (
                  filteredReservas.map(res => (
                    <tr key={res.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-mono font-extrabold text-[11px] bg-brand-50 text-brand-800 border border-brand-200 px-2 py-0.5 rounded-lg shadow-2xs">
                          #{res.codigo_reserva || (String(res.id).startsWith('res-') ? 'RES-' + String(res.id).slice(-4).toUpperCase() : res.id)}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap font-medium text-zinc-600">
                        {new Date(res.created_at).toLocaleString('es-CL', {
                          day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="p-3 font-bold text-zinc-900 whitespace-nowrap">
                        {res.cliente_nombre}
                      </td>
                      <td className="p-3 whitespace-nowrap font-mono text-zinc-700">
                        <a
                          href={`https://wa.me/${(res.cliente_whatsapp || '').replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-700 font-bold hover:underline"
                        >
                          {res.cliente_whatsapp || 'N/A'}
                        </a>
                      </td>
                      <td className="p-3 font-medium text-zinc-700 whitespace-nowrap">
                        {res.cliente_comuna || 'Concepción'}
                      </td>
                      <td className="p-3 max-w-xs">
                        {res.items && res.items.length > 0 ? (
                          <div className="space-y-1">
                            {res.items.map((it, idx) => (
                              <div key={idx} className="text-[11px] text-zinc-700">
                                • <strong className="text-zinc-900">{it.codigo_modelo}</strong> ({it.color}, T{it.talla}) x{it.quantity}
                              </div>
                            ))}
                            <div className="text-[10px] text-zinc-400 font-medium">{res.tipo_entrega}</div>
                          </div>
                        ) : res.modelo_codigo && res.modelo_codigo !== 'Consulta General' ? (
                          <div className="space-y-0.5">
                            <div className="text-[11px] text-zinc-700">
                              • <strong className="text-zinc-900">{res.modelo_codigo}</strong> {res.color ? `(${res.color}, T${res.talla})` : ''} x{res.cantidad || 1}
                            </div>
                            <div className="text-[10px] text-zinc-400 font-medium">{res.tipo_entrega}</div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="text-[11px] text-zinc-700 font-medium">{res.notas || 'Consulta general'}</span>
                            <div className="text-[10px] text-zinc-400">{res.tipo_entrega}</div>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                          res.estado === 'Completada'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : res.estado === 'Cancelada'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {res.estado || 'Pendiente'}
                        </span>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap space-x-1.5">
                        {res.estado === 'Pendiente' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleConvertirReservaAVenta(res)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                              title="Cargar al módulo de venta para cobrar y descontar stock"
                            >
                              <span>Convertir a Venta</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCambiarEstadoReserva(res.id, 'Cancelada')}
                              className="px-2 py-1 bg-zinc-100 hover:bg-rose-50 text-zinc-600 hover:text-rose-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                              title="Cancelar reserva"
                            >
                              ✕
                            </button>
                          </>
                        )}
                        {res.estado === 'Cancelada' && (
                          <button
                            type="button"
                            onClick={() => handleCambiarEstadoReserva(res.id, 'Pendiente')}
                            className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-medium cursor-pointer"
                          >
                            Reabrir
                          </button>
                        )}
                        {res.estado === 'Completada' && (
                          <span className="text-[11px] text-emerald-700 font-bold flex items-center justify-end gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Venta Realizada</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DETALLE DE MOVIMIENTOS KARDEX                                      */}
      {/* ========================================================================= */}
      {activeTab === 'movimientos' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200 shadow-xs space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
            <div>
              <h3 className="font-display font-bold text-lg text-zinc-900 flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <span>Detalle de Movimientos de Inventario (Kardex)</span>
              </h3>
              <p className="text-xs text-zinc-500">
                Auditoría en tiempo real de ventas, devoluciones y ajustes con fecha de operación y registro.
              </p>
            </div>

            <button
              type="button"
              onClick={loadMovimientos}
              disabled={isLoadingMovimientos}
              className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingMovimientos ? 'animate-spin' : ''}`} />
              <span>Refrescar</span>
            </button>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar por código, modelo, color, talla, vendedor o nota..."
                value={movSearch}
                onChange={e => setMovSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-400" />
              <select
                value={movFilterTipo}
                onChange={e => setMovFilterTipo(e.target.value)}
                className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800"
              >
                <option value="todos">Todos los Tipos ({movimientos.length})</option>
                <option value="Venta">Solo Ventas</option>
                <option value="Devolucion">Solo Devoluciones</option>
                <option value="Ajuste">Ajustes / Ingresos</option>
              </select>
            </div>
          </div>

          {/* Tabla de Movimientos */}
          <div className="border border-zinc-200 rounded-2xl overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[850px]">
              <thead className="bg-zinc-50 text-zinc-500 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-200">
                <tr>
                  <th className="p-3">Fecha Operación</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Calzado (Modelo / Color / Talla)</th>
                  <th className="p-3 text-center">Cant.</th>
                  <th className="p-3">Monto Cobrado</th>
                  <th className="p-3">Comisión</th>
                  <th className="p-3">Vendedor & Pago</th>
                  <th className="p-3">Registro BD</th>
                  <th className="p-3">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {isLoadingMovimientos ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-zinc-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-600 mb-2" />
                      <span>Cargando historial de movimientos...</span>
                    </td>
                  </tr>
                ) : filteredMovimientos.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-zinc-400 font-medium">
                      No se encontraron registros de movimientos con los filtros ingresados.
                    </td>
                  </tr>
                ) : (
                  filteredMovimientos.map(mov => {
                    const prod = mov.inventario_variantes?.productos;
                    const isVenta = (mov.tipo_movimiento || '').toLowerCase().includes('venta');
                    const isDev = (mov.tipo_movimiento || '').toLowerCase().includes('devoluc');
                    const fechaOp = mov.ventas?.fecha_venta 
                      ? new Date(mov.ventas.fecha_venta).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      : new Date(mov.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });

                    const fechaRegistro = new Date(mov.created_at).toLocaleString('es-CL', {
                      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
                    });

                    return (
                      <tr key={mov.id} className="hover:bg-zinc-50/70 transition-colors">
                        <td className="p-3 font-semibold text-zinc-800 whitespace-nowrap">
                          {fechaOp}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                            isVenta
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isDev
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}>
                            {mov.tipo_movimiento}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-zinc-900">
                            {prod?.codigo_modelo || 'N/A'} - {prod?.nombre_fantasia || ''}
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            Color: <strong className="text-zinc-700">{mov.inventario_variantes?.color}</strong> • Talla: <strong className="text-brand-800 font-bold">{mov.inventario_variantes?.talla}</strong>
                          </div>
                        </td>
                        <td className="p-3 text-center font-extrabold text-sm">
                          {isVenta ? `-${mov.cantidad}` : `+${mov.cantidad}`}
                        </td>
                        <td className="p-3 font-bold text-zinc-900 whitespace-nowrap">
                          ${mov.precio_aplicado ? Number(mov.precio_aplicado).toLocaleString('es-CL') : '0'}
                        </td>
                        <td className="p-3 font-medium text-brand-700 whitespace-nowrap">
                          ${mov.comision_vendedor ? Number(mov.comision_vendedor).toLocaleString('es-CL') : '0'}
                        </td>
                        <td className="p-3 text-zinc-700 whitespace-nowrap">
                          <div className="font-semibold text-zinc-800">{mov.ventas?.vendedor || 'Carmen'}</div>
                          <div className="text-[11px] text-zinc-400">{mov.ventas?.medio_pago || 'N/A'}</div>
                        </td>
                        <td className="p-3 font-mono text-[10px] text-zinc-400 whitespace-nowrap">
                          {fechaRegistro}
                        </td>
                        <td className="p-3 text-[11px] text-zinc-500 max-w-xs truncate" title={mov.notas || mov.ventas?.notas}>
                          {mov.notas || mov.ventas?.notas || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 4: MÓDULO DE DEVOLUCIONES              */}
      {/* ========================================== */}
      {activeTab === 'devoluciones' && (
        <div className="max-w-2xl mx-auto bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200 shadow-xs space-y-6 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-zinc-900">Reintegro de Inventario (Devolución)</h3>
              <p className="text-xs text-zinc-500">Suma automáticamente la cantidad al stock disponible en bodega.</p>
            </div>
          </div>

          <form onSubmit={handleExecuteDevolucion} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-500 block mb-1 uppercase tracking-wider">
                Variante de Calzado a Reintegrar *:
              </label>
              <select
                required
                value={devVariantId}
                onChange={e => setDevVariantId(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm font-semibold text-zinc-900"
              >
                <option value="">-- Seleccionar Calzado --</option>
                {allVariants.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.codigo_modelo} - {v.nombre_fantasia} | {v.color} | Talla {v.talla} (Stock Actual: {v.stock_disponible}p)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 block mb-1 uppercase tracking-wider">
                  Cantidad de Pares *:
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={devCantidad}
                  onChange={e => setDevCantidad(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-500 block mb-1 uppercase tracking-wider">
                  Motivo de la Devolución *:
                </label>
                <select
                  value={devMotivo}
                  onChange={e => setDevMotivo(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm font-semibold text-zinc-900"
                >
                  <option value="Cambio de talla">Cambio de talla</option>
                  <option value="Fallo de fábrica">Fallo de fábrica</option>
                  <option value="Desistimiento de compra">Desistimiento de compra</option>
                  <option value="Garantía de calidad">Garantía de calidad</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-500 block mb-1 uppercase tracking-wider">
                ID de Venta Original (Opcional):
              </label>
              <input
                type="text"
                placeholder="UUID de la venta en Supabase (si existe)"
                value={devVentaId}
                onChange={e => setDevVentaId(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900"
              />
            </div>

            {devResult && (
              <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                devResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {devResult.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
                <span>{devResult.message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!devVariantId || isProcessingDev}
              className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-md transition-all active:scale-98 cursor-pointer"
            >
              {isProcessingDev ? 'Procesando Reintegro...' : 'Reintegrar Pares al Inventario'}
            </button>
          </form>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 5: GESTOR DE FOTOS POR MODELO Y COLOR & VISTA PREVIA  */}
      {/* ========================================================== */}
      {activeTab === 'imagenes' && (
        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
          {/* Selector de Modelo Principal */}
          <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-display font-bold text-lg text-zinc-900 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-teal-600" />
                  <span>Gestor de Fotografías por Modelo y Color</span>
                </h3>
                <p className="text-xs text-zinc-500">
                  Las fotos se asocian a nivel de modelo y color para que todas las tallas compartan automáticamente las mismas imágenes.
                </p>
              </div>

              {/* Selector de Modelo */}
              <div className="w-full sm:w-80">
                <select
                  value={selectedModelId}
                  onChange={e => setSelectedModelId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm font-bold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.codigo_modelo} - {p.nombre_fantasia || 'Sin Nombre'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Grid de Fotos Existentes del Modelo Seleccionado */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h4 className="font-display font-bold text-base text-zinc-900">
                  Fotografías Registradas para {currentSelectedProduct?.codigo_modelo} ({currentSelectedProduct?.nombre_fantasia})
                </h4>
                <span className="text-xs text-zinc-500">
                  {existingImagesForCurrentSelection.length} foto(s) cargadas en Supabase Storage
                </span>
              </div>
            </div>

            {existingImagesForCurrentSelection.length === 0 ? (
              <div className="p-8 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200 text-zinc-400">
                <ImageIcon className="w-10 h-10 mx-auto text-zinc-300 mb-2" />
                <p className="text-sm font-semibold text-zinc-700">No hay fotos registradas para este modelo aún</p>
                <p className="text-xs text-zinc-400 mt-1">Usa la sección inferior para cargar la foto de portada del color o modelo.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {existingImagesForCurrentSelection.map(img => (
                  <div
                    key={img.id}
                    className="group relative bg-zinc-50 rounded-2xl border border-zinc-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col"
                  >
                    <div className="aspect-[4/3] bg-zinc-100 overflow-hidden relative flex items-center justify-center">
                      <img
                        src={img.url}
                        alt={img.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(img)}
                        disabled={deletingImageId === img.id}
                        title="Eliminar esta foto y permitir reemplazarla"
                        className="absolute top-2 right-2 p-2 rounded-xl bg-rose-600/90 hover:bg-rose-700 text-white shadow-md transition-all opacity-90 sm:opacity-0 sm:group-hover:opacity-100 active:scale-95 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-3 text-xs space-y-1">
                      <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase ${
                        img.type === 'modelo'
                          ? 'bg-zinc-900 text-white'
                          : img.type === 'color'
                          ? 'bg-brand-100 text-brand-900 border border-brand-200'
                          : 'bg-teal-50 text-teal-800 border border-teal-200'
                      }`}>
                        {img.type === 'modelo' ? 'Foto Principal Modelo' : img.type === 'color' ? 'Portada Color' : 'Galería General'}
                      </span>
                      <p className="font-bold text-zinc-900 truncate">{img.title}</p>
                      <p className="text-[11px] text-zinc-400 truncate">{img.subtitle}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Formulario de Carga de Nuevas Fotos */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200 shadow-xs space-y-6">
            <h4 className="font-display font-bold text-base text-zinc-900 border-b border-zinc-100 pb-3 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-teal-600" />
              <span>Subir Nueva Foto / Reemplazo</span>
            </h4>

            <div className="space-y-4">
              {/* Tipo de Aplicación */}
              <div>
                <label className="text-xs font-bold text-zinc-500 block mb-1 uppercase tracking-wider">
                  Tipo de Foto a Vincular:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadTargetType('color')}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      uploadTargetType === 'color'
                        ? 'border-brand-600 bg-brand-50 text-brand-900 ring-1 ring-brand-500'
                        : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    1. Portada del Color (Todas las Tallas)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadTargetType('galeria')}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      uploadTargetType === 'galeria'
                        ? 'border-brand-600 bg-brand-50 text-brand-900 ring-1 ring-brand-500'
                        : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    2. Foto para Galería General
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadTargetType('modelo')}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      uploadTargetType === 'modelo'
                        ? 'border-brand-600 bg-brand-50 text-brand-900 ring-1 ring-brand-500'
                        : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    3. Foto Principal del Modelo
                  </button>
                </div>
              </div>

              {/* Selector de Color */}
              {(uploadTargetType === 'color' || uploadTargetType === 'galeria') && (
                <div>
                  <label className="text-xs font-bold text-zinc-500 block mb-1 uppercase tracking-wider">
                    Seleccionar Color a Aplicar *:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableColorsForModel.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColorName(color)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          selectedColorName === color
                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                            : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                        }`}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Zona de Drag & Drop */}
              <div className="border-2 border-dashed border-zinc-300 hover:border-brand-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-zinc-50 relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {filePreview ? (
                  <div className="flex flex-col items-center justify-center">
                    <img src={filePreview} alt="Preview" className="h-44 w-auto object-contain rounded-xl shadow-md mb-2" />
                    <span className="text-xs font-semibold text-brand-700">{selectedFile?.name}</span>
                    <span className="text-[11px] text-zinc-400">Clic para cambiar imagen</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-zinc-400">
                    <UploadCloud className="w-10 h-10 text-zinc-400 mb-2" />
                    <p className="font-display font-bold text-sm text-zinc-700">
                      Arrastra la foto aquí o haz clic para seleccionarla
                    </p>
                    <span className="text-xs text-zinc-400 mt-1">PNG, JPG, WEBP hasta 10MB</span>
                  </div>
                )}
              </div>

              {uploadStatus && (
                <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  uploadStatus.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {uploadStatus.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
                  <span>{uploadStatus.message}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleExecuteUpload}
                disabled={!selectedFile || isUploading}
                className="w-full py-3.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Subiendo a Supabase Storage...</span>
                  </>
                ) : (
                  <span>Subir Foto y Vincular a {currentSelectedProduct?.codigo_modelo} {uploadTargetType === 'color' ? `(${selectedColorName})` : ''}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: ⚙️ PARÁMETROS & CONFIGURACIÓN DINÁMICA DE LA TIENDA                 */}
      {/* ========================================================================= */}
      {activeTab === 'parametros' && (
        <div className="max-w-3xl mx-auto bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200 shadow-xs space-y-6 animate-fade-in">
          <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-zinc-100 text-zinc-800 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-zinc-900">Parámetros Dinámicos de la Tienda</h3>
              <p className="text-xs text-zinc-500">Configuración de contacto, WhatsApp oficial y modalidades de entrega.</p>
            </div>
          </div>

          {/* Advertencia de Teléfono no configurado */}
          {(!configParams.telefono_whatsapp || configParams.telefono_whatsapp.includes('00000000') || configParams.telefono_whatsapp.replace(/\D/g, '').length < 9) && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>⚠️ Configura un número de WhatsApp real (+569XXXXXXXX) para recibir las reservas y pedidos de clientes.</span>
            </div>
          )}

          <form onSubmit={handleSaveConfig} className="space-y-5">
            {/* Teléfono WhatsApp y Nombre */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 block mb-1 uppercase tracking-wider">
                  Teléfono WhatsApp Oficial (wa.me) *:
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
                  <input
                    type="text"
                    required
                    value={configParams.telefono_whatsapp}
                    onChange={e => setConfigParams({ ...configParams, telefono_whatsapp: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                    placeholder="+569XXXXXXXX"
                  />
                </div>
                <span className="text-[11px] text-zinc-400 mt-0.5 block">Receptor oficial de pedidos y reservas</span>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-500 block mb-1 uppercase tracking-wider">
                  Nombre de Vendedora de Contacto *:
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
                  <input
                    type="text"
                    required
                    value={configParams.nombre_vendedora || configParams.nombre_duena || 'Carmen'}
                    onChange={e => setConfigParams({ ...configParams, nombre_vendedora: e.target.value, nombre_duena: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm font-bold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                    placeholder="Carmen"
                  />
                </div>
              </div>
            </div>

            {/* Modalidad de la Tienda */}
            <div>
              <label className="text-xs font-bold text-zinc-500 block mb-1 uppercase tracking-wider">
                Modalidad de la Tienda (Online & Bodega) *:
              </label>
              <textarea
                rows={2}
                value={configParams.modalidad_tienda}
                onChange={e => setConfigParams({ ...configParams, modalidad_tienda: e.target.value })}
                className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm font-medium text-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 leading-relaxed"
              />
              <span className="text-[11px] text-zinc-400 mt-0.5 block">Utilizado por el Chatbot para orientar sobre la tienda física</span>
            </div>

            {/* Entregas Presenciales */}
            <div>
              <label className="text-xs font-bold text-zinc-500 block mb-1 uppercase tracking-wider flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                <span>Entregas Locales (Presenciales) *:</span>
              </label>
              <input
                type="text"
                value={configParams.entregas_locales}
                onChange={e => setConfigParams({ ...configParams, entregas_locales: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm font-medium text-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            {/* Envíos Nacionales */}
            <div>
              <label className="text-xs font-bold text-zinc-500 block mb-1 uppercase tracking-wider flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-zinc-400" />
                <span>Envíos Nacionales (Starken) *:</span>
              </label>
              <input
                type="text"
                value={configParams.envios_nacionales}
                onChange={e => setConfigParams({ ...configParams, envios_nacionales: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm font-medium text-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            {configStatusMsg && (
              <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                configStatusMsg.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {configStatusMsg.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                <span>{configStatusMsg.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSavingConfig}
              className="w-full py-3.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-md transition-all active:scale-98 cursor-pointer"
            >
              {isSavingConfig ? 'Guardando Parámetros...' : 'Guardar Parámetros de la Tienda'}
            </button>
          </form>

          {/* Zona de Peligro: Purgar Datos de Prueba */}
          <div className="pt-6 mt-6 border-t border-rose-200/80">
            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-sm text-rose-900">Zona de Depuración & Mantenimiento</h4>
                  <p className="text-xs text-rose-700 leading-relaxed">
                    Elimina todas las transacciones de prueba registradas en <strong>Reservas</strong>, <strong>Ventas</strong> y <strong>Kardex de Movimientos</strong>. El catálogo base de productos, variantes y configuración se mantiene 100% blindado e intacto.
                  </p>
                </div>
              </div>

              {purgeStatusMsg && (
                <div className="p-3 bg-white border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{purgeStatusMsg}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handlePurgarDatosPrueba}
                disabled={isPurgingData}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isPurgingData ? 'Purgando Datos de Prueba...' : '🧹 Purgar Datos de Prueba (Reservas y Ventas)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 7: MONITOR DE STOCK CRÍTICO           */}
      {/* ========================================== */}
      {activeTab === 'alertas' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200 shadow-xs space-y-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-display font-bold text-lg text-zinc-900">
                Pares en Estado Crítico o Agotados ({variantesCriticas.length})
              </h3>
              <p className="text-xs text-zinc-500">Variantes con 0, 1 o 2 pares en bodega para reposición prioritaria.</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar modelo o color..."
                value={alertSearch}
                onChange={e => setAlertSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="border border-zinc-200 rounded-2xl overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[600px]">
              <thead className="bg-zinc-50 text-zinc-500 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-200">
                <tr>
                  <th className="p-3">Código</th>
                  <th className="p-3">Nombre Modelo</th>
                  <th className="p-3">Color</th>
                  <th className="p-3">Talla</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Stock Bodega</th>
                  <th className="p-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {filteredAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-zinc-400">
                      No hay alertas de stock con los filtros ingresados.
                    </td>
                  </tr>
                ) : (
                  filteredAlerts.map(v => (
                    <tr key={v.id} className="hover:bg-zinc-50/60">
                      <td className="p-3 font-bold text-zinc-900">{v.codigo_modelo}</td>
                      <td className="p-3 text-zinc-600">{v.nombre_fantasia || 'N/A'}</td>
                      <td className="p-3 font-medium text-zinc-800">{v.color}</td>
                      <td className="p-3 font-extrabold text-brand-800">{v.talla}</td>
                      <td className="p-3 font-mono text-[11px] text-zinc-400">{v.sku_variante}</td>
                      <td className="p-3 font-extrabold text-sm">
                        {v.stock_disponible}p
                      </td>
                      <td className="p-3">
                        {v.stock_disponible === 0 ? (
                          <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                            Agotado (0p)
                          </span>
                        ) : (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                            Crítico ({v.stock_disponible}p)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
