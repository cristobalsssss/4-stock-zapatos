# TASK_PLAN.MD - HOJA DE RUTA Y PLAN DE EJECUCIÓN

## FASE 1: CONFIGURACIÓN DE ENTORNO Y DOCUMENTACIÓN
- [x] Crear estructura local del proyecto (`4-Stock-Zapatos`)
- [x] Configurar repositorio Git remoto en GitHub (`https://github.com/cristobalsssss/4-stock-zapatos.git`)
- [x] Configurar `.vscode/tasks.json` y `.clinerules`
- [x] Generar documentación de arquitectura en `docs/` (`agents.md`, `web_spec.md`, `task_plan.md`, `project_state.json`)

## FASE 2: DESPLIEGUE EN SUPABASE (BASE DE DATOS Y STORAGE)
- [ ] Crear proyecto en Supabase (Plan Free)
- [ ] Ejecutar script SQL de creación de las 5 tablas (`productos`, `inventario_variantes`, `imagenes_variante`, `ventas`, `detalle_movimientos`)
- [ ] Crear Bucket público `productos-imagenes` en Supabase Storage
- [ ] Cargar datos iniciales del catálogo desde el archivo `Stock Zapatos 15-08-2026.xlsx - Agosto-2026.csv`

## FASE 3: CONSTRUCCIÓN DE SKILLS DE NEGOCIO EN N8N
- [ ] Crear Workflow/Skill 1: `ConsultarStock` (Endpoint REST para obtener disponibilidad por modelo/color/talla)
- [ ] Crear Workflow/Skill 2: `RegistrarVentaYDescontarStock` (Registra en `ventas` y `detalle_movimientos`, resta stock y calcula comisión)
- [ ] Crear Workflow/Skill 3: `RegistrarDevolucion` (Revierte transacción y suma stock)

## FASE 4: VIBE CODING DEL FRONTEND EN VERCEL
- [ ] Generar estructura inicial del Frontend Web (Catálogo + Admin)
- [ ] Conectar vista de catálogo público con Supabase/n8n
- [ ] Implementar visualizador de variante y galería multi-ángulo
- [ ] Implementar Panel Admin para simular ventas, devoluciones y ver kardex
- [ ] Desplegar sitio web en Vercel

## FASE 5: PRUEBAS END-TO-END Y VALIDACIÓN
- [ ] Simular venta completa y validar descuento de stock en tiempo real
- [ ] Validar cálculo de comisión de vendedor
- [ ] Simular devolución y verificar reintegro al inventario