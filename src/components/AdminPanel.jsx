import React, { useState, useMemo } from 'react';
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
  RefreshCw
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
  eliminarImagenGaleria 
} from '../lib/api';

export default function AdminPanel({ products, onDataChanged }) {
  const [activeTab, setActiveTab] = useState('ventas'); // 'ventas' | 'devoluciones' | 'imagenes' | 'alertas'

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

  // ==========================================
  // ESTADO PARA TAB 1: VENTA MULTI-PRODUCTO
  // ==========================================
  const [fechaVenta, setFechaVenta] = useState(() => new Date().toISOString().split('T')[0]);
  const [vendedor, setVendedor] = useState('admin_stephanie');
  const [medioPago, setMedioPago] = useState('Transferencia');
  const [notasVenta, setNotasVenta] = useState('');
  const [saleItems, setSaleItems] = useState([]);
  const [selectedVariantToAdd, setSelectedVariantToAdd] = useState('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [saleResult, setSaleResult] = useState(null);

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

  const handleRemoveSaleItem = (varId) => {
    setSaleItems(prev => prev.filter(item => item.variante_id !== varId));
  };

  const totalMontoVenta = saleItems.reduce((acc, item) => acc + (item.precio_unitario * item.cantidad), 0);
  const totalComisionVenta = saleItems.reduce((acc, item) => {
    if (vendedor.toLowerCase().includes('admin') || vendedor.toLowerCase().includes('dueño')) {
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
        const comisionItem = (vendedor.toLowerCase().includes('admin') || vendedor.toLowerCase().includes('dueño'))
          ? 0
          : Math.max(0, (item.precio_unitario - item.precio_interno) * item.cantidad);

        await registrarVenta({
          variante_id: item.variante_id,
          cantidad: item.cantidad,
          vendedor,
          medio_pago: medioPago,
          precio_aplicado: item.precio_unitario,
          comision_vendedor: comisionItem,
          notas: notasVenta || `Venta Multi-par (${vendedor})`,
          fecha_venta: new Date(fechaVenta).toISOString()
        });
      }

      setSaleResult({
        success: true,
        message: `¡Venta de ${saleItems.length} producto(s) procesada con éxito y stock actualizado!`
      });
      setSaleItems([]);
      setNotasVenta('');
      if (onDataChanged) onDataChanged();
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

  // ==========================================
  // ESTADO PARA TAB 2: DEVOLUCIONES
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
  // ESTADO PARA TAB 3: GESTOR DE FOTOS POR MODELO Y COLOR
  // ==========================================================
  const [uploadTargetType, setUploadTargetType] = useState('color'); // 'color' | 'modelo' | 'galeria'
  const [selectedModelId, setSelectedModelId] = useState(() => products[0]?.id || '');
  const [selectedColorName, setSelectedColorName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [deletingImageId, setDeletingImageId] = useState(null);

  // Modelo actualmente seleccionado en el gestor de imágenes
  const currentSelectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedModelId) || products[0] || null;
  }, [products, selectedModelId]);

  // Colores únicos del modelo seleccionado
  const availableColorsForModel = useMemo(() => {
    if (!currentSelectedProduct) return [];
    const setColores = new Set();
    (currentSelectedProduct.inventario_variantes || []).forEach(v => {
      if (v.color) setColores.add(v.color.trim());
    });
    return Array.from(setColores);
  }, [currentSelectedProduct]);

  // Auto-seleccionar primer color si no hay ninguno seleccionado o cambió el modelo
  React.useEffect(() => {
    if (availableColorsForModel.length > 0 && (!selectedColorName || !availableColorsForModel.includes(selectedColorName))) {
      setSelectedColorName(availableColorsForModel[0]);
    }
  }, [availableColorsForModel, selectedColorName]);

  // Imágenes existentes del modelo / color seleccionado para la vista previa en grid
  const existingImagesForCurrentSelection = useMemo(() => {
    if (!currentSelectedProduct) return [];
    const list = [];

    // 1. Imagen por defecto del modelo
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

    // 2. Portadas de Colores
    const variantes = currentSelectedProduct.inventario_variantes || [];
    const portadasPorColor = new Map();

    variantes.forEach(v => {
      if (v.imagen_portada_variante && !portadasPorColor.has(v.color)) {
        portadasPorColor.set(v.color, v.imagen_portada_variante);
      }
    });

    portadasPorColor.forEach((imgUrl, colorName) => {
      // Si la URL no es idéntica a la principal de modelo
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

    // 3. Galería General
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

  // ==========================================
  // TAB 4: BÚSQUEDA EN ALERTAS
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
            Consola Privada
          </span>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-zinc-900 tracking-tight mt-1">
            Panel de Operaciones & Inventario
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Registro de ventas multi-par, devoluciones, gestión de fotos por color y control de stock.
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
            <span className="text-xs font-bold uppercase tracking-wider">Variantes Activas</span>
            <Sparkles className="w-4 h-4 text-brand-600" />
          </div>
          <div className="font-display font-extrabold text-2xl sm:text-3xl text-brand-700">
            {variantesConStock.length}
          </div>
          <span className="text-[11px] text-zinc-400">de 714 totales</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Alertas Stock</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="font-display font-extrabold text-2xl sm:text-3xl text-amber-700">
            {variantesCriticas.length}
          </div>
          <span className="text-[11px] text-amber-600 font-medium">0 o &lt;= 2 pares</span>
        </div>
      </div>

      {/* TABS DE NAVEGACIÓN */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2">
        <button
          onClick={() => setActiveTab('ventas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            activeTab === 'ventas'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
          }`}
        >
          <DollarSign className="w-4 h-4 text-brand-400" />
          <span>Ventas Multi-Producto</span>
        </button>

        <button
          onClick={() => setActiveTab('devoluciones')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            activeTab === 'devoluciones'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
          }`}
        >
          <RotateCcw className="w-4 h-4 text-amber-400" />
          <span>Devoluciones</span>
        </button>

        <button
          onClick={() => setActiveTab('imagenes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            activeTab === 'imagenes'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
          }`}
        >
          <UploadCloud className="w-4 h-4 text-teal-400" />
          <span>Gestor de Fotos & Galería</span>
        </button>

        <button
          onClick={() => setActiveTab('alertas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            activeTab === 'alertas'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>Monitor de Stock Crítico ({variantesCriticas.length})</span>
        </button>
      </div>

      {/* ========================================== */}
      {/* TAB 1: TERMINAL DE VENTAS MULTI-PRODUCTO   */}
      {/* ========================================== */}
      {activeTab === 'ventas' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Columna Izquierda: Configuración de la Venta */}
          <div className="lg:col-span-2 space-y-6">
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
                      {v.codigo_modelo} - {v.nombre_fantasia} | {v.color} | Talla {v.talla} (Stock: {v.stock_disponible}p) - ${Number(v.precio_vendedores).toLocaleString('es-CL')}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleAddVariantToSale}
                  disabled={!selectedVariantToAdd}
                  className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all"
                >
                  + Agregar Par
                </button>
              </div>

              {/* Tabla de Items en la Venta */}
              <div className="border border-zinc-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 text-zinc-500 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-200">
                    <tr>
                      <th className="p-3">Calzado</th>
                      <th className="p-3">Color/Talla</th>
                      <th className="p-3">Precio Unit.</th>
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
                          <td className="p-3 font-semibold text-zinc-900">
                            ${item.precio_unitario.toLocaleString('es-CL')}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleUpdateSaleItemQty(item.variante_id, item.cantidad - 1)}
                                className="w-6 h-6 rounded bg-zinc-100 hover:bg-zinc-200 font-bold text-zinc-700 flex items-center justify-center"
                              >
                                -
                              </button>
                              <span className="w-6 text-center font-bold">{item.cantidad}</span>
                              <button
                                onClick={() => handleUpdateSaleItemQty(item.variante_id, item.cantidad + 1)}
                                className="w-6 h-6 rounded bg-zinc-100 hover:bg-zinc-200 font-bold text-zinc-700 flex items-center justify-center"
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
                              onClick={() => handleRemoveSaleItem(item.variante_id)}
                              className="text-zinc-400 hover:text-rose-600 p-1"
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

              {/* Vendedor */}
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
                    <option value="admin_stephanie">admin_stephanie (Dueño / Venta Directa $0 Com)</option>
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
                  placeholder="Ej: Cliente retira en showroom..."
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
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-md transition-all active:scale-98"
              >
                {isProcessingSale ? 'Procesando Venta y Stock...' : 'Confirmar Venta y Descontar Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 2: MÓDULO DE DEVOLUCIONES              */}
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
              className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-md transition-all active:scale-98"
            >
              {isProcessingDev ? 'Procesando Reintegro...' : 'Reintegrar Pares al Inventario'}
            </button>
          </form>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 3: GESTOR DE FOTOS POR MODELO Y COLOR & VISTA PREVIA  */}
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
                    {/* Imagen */}
                    <div className="aspect-[4/3] bg-zinc-100 overflow-hidden relative flex items-center justify-center">
                      <img
                        src={img.url}
                        alt={img.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {/* Botón de Eliminación Rápida */}
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(img)}
                        disabled={deletingImageId === img.id}
                        title="Eliminar esta foto y permitir reemplazarla"
                        className="absolute top-2 right-2 p-2 rounded-xl bg-rose-600/90 hover:bg-rose-700 text-white shadow-md transition-all opacity-90 sm:opacity-0 sm:group-hover:opacity-100 active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Información y Tag */}
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
                    className={`p-3 rounded-xl border text-xs font-bold transition-all ${
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
                    className={`p-3 rounded-xl border text-xs font-bold transition-all ${
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
                    className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                      uploadTargetType === 'modelo'
                        ? 'border-brand-600 bg-brand-50 text-brand-900 ring-1 ring-brand-500'
                        : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    3. Foto Principal del Modelo
                  </button>
                </div>
              </div>

              {/* Selector de Color si aplica */}
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
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
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
                className="w-full py-3.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2"
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

      {/* ========================================== */}
      {/* TAB 4: MONITOR DE STOCK CRÍTICO           */}
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
            <table className="w-full text-left text-xs">
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
