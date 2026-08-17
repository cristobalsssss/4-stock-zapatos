# TASK_PLAN.MD - HOJA DE RUTA Y PLAN DE EJECUCIÓN

## FASE 1: CONFIGURACIÓN DE ENTORNO Y DOCUMENTACIÓN
- [x] Crear estructura local del proyecto (`4-Stock-Zapatos`)
- [x] Configurar repositorio Git remoto en GitHub (`https://github.com/cristobalsssss/4-stock-zapatos.git`)
- [x] Configurar `.vscode/tasks.json` y `.clinerules`
- [x] Generar documentación de arquitectura en `docs/` (`agents.md`, `web_spec.md`, `task_plan.md`, `project_state.json`)

## FASE 2: DESPLIEGUE EN SUPABASE (BASE DE DATOS Y STORAGE)
- [x] Crear proyecto en Supabase (Plan Free)
- [x] Ejecutar script SQL de creación de las 5 tablas base (`productos`, `inventario_variantes`, `imagenes_variante`, `ventas`, `detalle_movimientos`) + tablas proactivas, triggers de kardex/precios y vistas analíticas
- [x] Crear y configurar como públicos los Buckets `productos` y `productos-imagenes` en Supabase Storage
- [x] Cargar datos iniciales del catálogo mediante script de inicialización (`supabase/seed.sql`)
- [x] Cargar inventario real desde Excel (`data/inventario_real.xlsx`) mediante script ETL con herencia de celdas combinadas (84 modelos, 714 variantes, 253 unidades en stock)

## FASE 3: CONSTRUCCIÓN DE SKILLS DE NEGOCIO EN N8N
- [x] Crear Workflow/Skill 1: `ConsultarStock` (Endpoint REST para obtener disponibilidad por modelo/color/talla)
- [x] Crear Workflow/Skill 2: `RegistrarVentaYDescontarStock` (Registra en `ventas` y `detalle_movimientos`, resta stock y calcula comisión)
- [x] Crear Workflow/Skill 3: `RegistrarDevolucion` (Revierte transacción y suma stock)

## FASE 4: VIBE CODING DEL FRONTEND EN VERCEL
- [x] Generar estructura inicial del Frontend Web (Catálogo + Admin) en React + Vite + Tailwind CSS
- [x] Conectar vista de catálogo público con Supabase/n8n con buscador y filtros en tiempo real
- [x] Implementar visualizador de variante, alertas de stock y galería multi-ángulo modal
- [x] Implementar Bolsa de Reserva con redirección inteligente y mensaje formateado a WhatsApp directo
- [x] Implementar Panel Admin protegido por PIN para venta multi-producto, devoluciones y subida de fotos drag & drop a Storage
- [ ] Desplegar sitio web en Vercel

## FASE 5: PRUEBAS END-TO-END Y VALIDACIÓN
- [ ] Simular venta completa y validar descuento de stock en tiempo real
- [ ] Validar cálculo de comisión de vendedor
- [ ] Simular devolución y verificar reintegro al inventario