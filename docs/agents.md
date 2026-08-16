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