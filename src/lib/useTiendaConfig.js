import { useState, useEffect, useCallback } from 'react';
import { getConfiguracion, guardarConfiguracion } from './api';

export function useTiendaConfig() {
  const [config, setConfig] = useState({
    telefono_whatsapp: '+56900000000',
    nombre_vendedora: 'Carmen',
    modalidad_tienda: 'Venta 100% online, sin tienda física abierta al público. Precios de remate y liquidación de bodega hasta agotar stock.',
    entregas_locales: 'Entregas presenciales en Concepción y Penco (a coordinar con Carmen).',
    envios_nacionales: 'Envíos por Starken a todo Chile en modalidad "Por Pagar".'
  });
  const [isLoaded, setIsLoaded] = useState(false);

  const refreshConfig = useCallback(async () => {
    try {
      const data = await getConfiguracion();
      setConfig(data);
      setIsLoaded(true);
    } catch (e) {
      console.error('Error al cargar configuración en hook:', e);
    }
  }, []);

  useEffect(() => {
    refreshConfig();

    const handleConfigUpdated = (e) => {
      if (e.detail) {
        setConfig(e.detail);
      } else {
        refreshConfig();
      }
    };

    window.addEventListener('config_updated', handleConfigUpdated);
    window.addEventListener('storage', refreshConfig);

    return () => {
      window.removeEventListener('config_updated', handleConfigUpdated);
      window.removeEventListener('storage', refreshConfig);
    };
  }, [refreshConfig]);

  const updateConfig = async (newConfig) => {
    const saved = await guardarConfiguracion(newConfig);
    setConfig(saved);
    window.dispatchEvent(new CustomEvent('config_updated', { detail: saved }));
    return saved;
  };

  return { config, updateConfig, isLoaded, refreshConfig };
}
