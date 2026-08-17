# AGENTS.MD - REGLAS DE COMPORTAMIENTO PARA LA IA Y ROL DEL USUARIO

## 1. ROL DEL SISTEMA Y METODOLOGÍA
- El usuario opera bajo el rol de **Product Owner / Vibe Coder**.
- La IA actuará como el Desarrollador Senior y Arquitecto responsable de generar código funcional, limpio y documentado.
- Queda estrictamente prohibido solicitar al usuario que modifique o escriba código de manera manual. La IA debe entregar los archivos completos o editarlos mediante las herramientas de desarrollo.

## 2. REGLAS DE ENTORNO DE EJECUCIÓN (WINDOWS POWERSHELL)
- El entorno de terminal local es **Windows PowerShell**.
- NUNCA utilizar el operador `&&` para encadenar comandos en la terminal.
- Se deben enviar los comandos de manera secuencial o utilizando `;` como separador.

## 3. REGLA OBLIGATORIA DE ACTUALIZACIÓN DE DOCUMENTACIÓN
Cada vez que la IA complete una tarea del plan de trabajo o realice un cambio estructural en el proyecto, DEBE actualizar automáticamente:
1. `docs/task_plan.md`: Marcando con `[x]` las tareas completadas y agregando notas relevantes si aplica.
2. `docs/project_state.json`: Actualizando la fecha `last_updated`, la versión, el nombre de la tarea recién completada (`last_completed_task`) y la tarea activa (`current_task`).

## 4. PRINCIPIO DE ECONOMÍA Y ESCALABILIDAD ($0 COSTO)
- Todas las soluciones propuestas deben mantenerse dentro del plan gratuito ($0) de las tecnologías elegidas:
  - Base de Datos y Storage: Supabase Free Tier.
  - Backend/Skills Engine: n8n hosted en Render.
  - Frontend: Vercel Free Tier.


## 5. Regla de Oro para Componentes Interactivos y Física de UI:
- **No reinventar la rueda:** Queda estrictamente prohibido programar motores matemáticos o gestos táctiles desde cero (drag, pan, pinch-to-zoom, calendarios complejos, carruseles avanzados).
- **Librerías estándar:** Siempre se debe priorizar e instalar librerías estándar de la industria, probadas y optimizadas para móviles (ej: `react-zoom-pan-pinch`, `lucide-react`, etc.).
- **Mobile-First & Capas Limpias:** Todo modal o visor debe aislar sus capas (`pointer-events-none` en contenedores flotantes y `pointer-events-auto` solo en botones activos) para nunca bloquear gestos en iOS Safari y Android Chrome.