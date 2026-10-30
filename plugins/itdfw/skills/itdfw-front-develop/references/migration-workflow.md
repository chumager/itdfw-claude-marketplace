# Workflow: Migración de Componente a JSX Nativo

## Preparar ambiente
1. **GI front a .bak**: `mv fronts/.../components/GenericInput.jsx fronts/.../components/GenericInput.jsx.bak` — fuerza que cargue GI core (nativo, sin BV)
2. **Componente front .vue a .bak**: `mv fronts/.../components/ItdX.vue fronts/.../components/ItdX.vue.bak` — fuerza que localImport encuentre el core
3. **Reiniciar dev server**: `tmux send-keys -t FW:8.1 C-c "" && sleep 2 && tmux send-keys -t FW:8.1 Up Enter` — HMR no detecta archivos movidos/nuevos

## Crear y probar core nativo
4. **Crear componente core**: `libs/itdfw-site-vue-core/src/components/ItdX.jsx` — extends GenericInput (global), configurar data/methods
5. **Agregar test en TestFormPage**: input + valor inicial en `fronts/.../testGI/TestFormPage.jsx`
6. **Probar en `/test-form`**: URL `http://localhost:8080/test-form`
   - Verificar: valor inicial correcto, edición funciona, valor emitido en JSON de abajo
   - Verificar: sin sobre-render injustificado (console.log en render del TestForm)
   - Verificar: validadores funcionan si aplica
   - **NO** navegar a rutas reales (requieren login/AAA)

## Crear front JSX (solo si necesario)
7. **¿Necesita front?**: Si el nativo se ve bien y funciona → NO crear front (ej: ItdDate pasa directo). Solo crear front si necesita BV visual o funcionalidad específica
8. **Restaurar GI front**: `mv fronts/.../components/GenericInput.jsx.bak fronts/.../components/GenericInput.jsx`
9. **Crear front JSX**: `fronts/.../components/ItdX.jsx` — extends core (o GI directo si paradigma es totalmente distinto)
10. **Reiniciar dev server** (de nuevo, archivos nuevos)
11. **Probar en `/test-form`** con GI front activo — mismo checklist del paso 6

## Ciclar
- Repetir pasos 4-11 por cada componente
- Al terminar todos, limpiar: remover .bak, remover tests temporales de TestFormPage

## Errores comunes en este workflow

| Error | Síntoma | Fix |
|-------|---------|-----|
| No mover GI front a .bak | Componente renderiza con BV en vez de nativo | Paso 1 |
| No reiniciar dev server | Componente viejo sigue cargando, cambios no aparecen | Paso 3 |
| Navegar a ruta real | Página en blanco o redirect a login | Usar solo `/test-form` o `/test-gi` |
| Crear componente en front en vez de core | No funciona sin BV, no es agnóstico | Core primero, siempre |
| Olvidar restaurar GI front para probar front JSX | Front JSX carga pero renderiza nativo | Paso 8 |
