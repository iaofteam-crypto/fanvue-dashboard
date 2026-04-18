# AUDITORÍA CRÍTICA — Fanvue Ops Dashboard
**Ciclo**: HB#57 | **Fecha**: 2026-04-18 | **Autor**: iaofteam-3 (OFIA-BOT)

---

## RESUMEN EJECUTIVO

Auditoría completa del código fuente de `iaofteam-crypto/fanvue-dashboard`. Se encontraron **38 problemas** distribuidos en 5 categorías: 8 bugs críticos, 7 problemas de arquitectura, 12 gaps de funcionalidad, 6 mejoras UX/UI, y 5 problemas de seguridad.

**Veredicto**: La app funciona visualmente como demo, pero la mayoría de las features son hardcoded/fake. Solo la conexión OAuth y el proxy Fanvue son funcionales de verdad. El resto (analytics, discoveries, tasks, repo browser) son mock data que no se conecta a nada real.

---

## 🔴 BUGS CRÍTICOS (8)

### B1. GITHUB_TOKEN y GITHUB_REPO crashan la app en cold start
- **Archivo**: `src/lib/github.ts` líneas 3-4
- **Problema**: `const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;` y `const GITHUB_REPO = process.env.GITHUB_REPO!;`
- El CEO dijo explícitamente que NO puso esas variables en Vercel. El `!` (non-null assertion) va a tirar `undefined` en runtime, lo que puede causar errores en las llamadas a GitHub API.
- **Impacto**: El repo browser, el sync-repo cron, y cualquier endpoint que importe `github.ts` van a fallar silenciosamente o crashar.
- **Fix**: Usar valores por defecto o hacer las variables opcionales. Si no hay token, las funciones de GitHub deberían retornar datos vacíos gracefulmente en vez de crashar.

### B2. In-memory store pierde TODO en cold starts de Vercel
- **Archivo**: `src/lib/db.ts` líneas 43-47
- **Problema**: `store.tokens`, `store.syncLogs`, `store.discoveries` son Maps in-memory. En Vercel serverless, cada cold start resetea todo. Sin Vercel KV configurado, el token OAuth se pierde constantemente.
- **Impacto**: El usuario se desconecta cada vez que Vercel hace un cold start (puede ser cada 5-15 minutos en Hobby). Tienen que re-autenticar con Fanvue constantemente.
- **Fix**: Esto es un **blocker de producción**. Necesita Vercel KV (Redis) obligatorio, no optional. O alternativamente, usar cookies encriptadas para persistir el token client-side.

### B3. sync-fanvue NO guarda los datos que obtiene
- **Archivo**: `src/app/api/crons/sync-fanvue/route.ts`
- **Problema**: El cron fetch data de 9 endpoints Fanvue (`/users/me`, `/chats`, `/posts`, etc.) usando `Promise.allSettled`, cuenta cuáles funcionaron, y... **descarta los datos**. Solo guarda un log de "synced 7/9 endpoints" pero la data real nunca se almacena en ningún lado.
- **Impacto**: El cron corre diario pero es completamente inútil. Los dashboards nunca muestran datos reales porque nunca se guardan.
- **Fix**: Almacenar la respuesta de cada endpoint en el store (o KV) para que las secciones del dashboard puedan consumir datos cached/synced.

### B4. sync/reoute.ts (manual "Sync Now") es fake
- **Archivo**: `src/app/api/sync/route.ts`
- **Problema**: El endpoint POST `/api/sync` no llama a ningún endpoint de Fanvue. Solo crea logs que dicen "sync initiated" y checkea si el token existe. No descarga ni procesa datos.
- **Impacto**: El botón "Sync Now" en Connection section le hace creer al usuario que algo pasó, pero es un no-op.
- **Fix**: Debería invocar la misma lógica que sync-fanvue, o al menos disparar los fetch reales.

### B5. Analytics muestra 100% datos hardcoded
- **Archivo**: `src/components/dashboard/analytics-section.tsx` líneas 21-64
- **Problema**: `EARNINGS_DATA`, `SUBSCRIBER_DATA`, `ENGAGEMENT_DATA`, `REVENUE_SOURCES` son constantes hardcodeadas. No hay ningún `fetch` ni llamada a API. El period selector (`7d`, `30d`, `3m`, `12m`) cambia el estado pero no filtra nada.
- **Impacto**: El usuario ve números falsos creyendo que son datos reales de su cuenta Fanvue.
- **Fix**: Fetch real desde `/api/fanvue/insights/*` y procesar los datos dinámicamente según el período seleccionado.

### B6. Discoveries, Tasks, y Repo Browser son 100% demo data
- **Archivos**: `discoveries-section.tsx`, `tasks-section.tsx`, `repo-browser.tsx`
- **Problema**: Las tres secciones usan constantes `DEMO_DISCOVERIES`, `TASKS`, `DEMO_FILES`/`DEMO_CONTENT`. Nunca llaman a la API ni leen del store.
- **Impacto**: Parece una app funcional pero es un shell vacío con datos ficticios.
- **Fix**: Conectar discoveries al store (que sync-repo debería poblar), tasks al archivo TASKS.md del repo, repo browser al GitHub API.

### B7. Dashboard "Recent Activity" es hardcoded
- **Archivo**: `src/components/dashboard/dashboard-overview.tsx` líneas 195-213
- **Problema**: Las activities ("New message from fan", "Tip received — $25.00", etc.) son estáticas. Nunca cambian.
- **Fix**: Construir una timeline real basada en los eventos del sync (mensajes nuevos, tips, suscriptores, etc.).

### B8. AELIANA chat NO tiene contexto de datos reales
- **Archivo**: `src/app/api/chat/route.ts`
- **Problema**: El system prompt le dice a AELIANA que tiene acceso a datos del creator, pero **nunca se le pasa ningún dato real**. Los messages solo incluyen el historial del chat, no los datos de Fanvue.
- **Impacto**: AELIANA da consejos genéricos sin poder referenciar métricas reales del usuario.
- **Fix**: Antes de llamar al LLM, fetch datos del store (earnings, subscribers, etc.) e inyectarlos como contexto en el system prompt.

---

## 🟠 PROBLEMAS DE ARQUITECTURA (7)

### A1. Sin code splitting — SPA monolítica
- **Problema**: `page.tsx` es un `"use client"` monolítico de 375 líneas que importa TODAS las secciones a la vez. Cada sección (analytics, messages, content, etc.) se carga en el bundle inicial aunque el usuario solo ve una.
- **Fix**: Usar `next/dynamic` para lazy-load las secciones no visibles. Esto reduciría el initial bundle de ~1MB+ a ~200KB.

### A2. `aeliana.ts` nunca se usa
- **Archivo**: `src/lib/aeliana.ts`
- **Problema**: Define `AELIANA_SYSTEM_PROMPT`, `AELIANA_MODES`, y `buildAelianaPrompt()` pero **ningún archivo los importa**. El `chat/route.ts` duplica la lógica del prompt inline.
- **Fix**: Importar `buildAelianaPrompt` en el chat route o eliminar el archivo muerto.

### A3. Estado de conexión con variables globales mutables
- **Archivo**: `src/app/page.tsx` líneas 147-163
- **Problema**: `connectionListeners`, `currentConnectionState` son variables module-level. En SSR o si el módulo se carga en múltiples instancias, esto rompe.
- **Fix**: Usar Zustand o React Context para el estado de conexión.

### A4. FanvueClient class nunca se usa
- **Archivo**: `src/lib/fanvue.ts` líneas 193-304
- **Problema**: La clase `FanvueClient` con métodos `getMe()`, `getChats()`, `getPosts()`, etc. **nunca es instanciada ni usada** en ningún lugar. El proxy route usa `fetch` directo en vez de la clase.
- **Fix**: Eliminar la clase muerta o usarla en el proxy route.

### A5. No hay error boundaries de React
- **Problema**: Ningún ErrorBoundary en la app. Un error en una sección crashea toda la página.
- **Fix**: Agregar ErrorBoundary alrededor de cada sección en `renderContent()`.

### A6. No hay paginación en ninguna lista
- **Problema**: Messages, posts, chats, discoveries — todos cargan todos los items de una vez. Fanvue API probablemente retorna datos paginados.
- **Fix**: Implementar pagination con cursors o offset en las llamadas API.

### A7. Bundle size por Recharts + shadcn/ui completo
- **Problema**: Se importan ~50 componentes shadcn/ui (carousel, input-otp, menubar, etc.) que probablemente no se usan. Recharts es ~400KB gzipped.
- **Fix**: Tree-shake los componentes shadcn no usados. Considerar un chart library más ligero como Chart.js o visx.

---

## 🟡 GAPS DE FUNCIONALIDAD (12)

### F1. No hay user profile después de conectar
- Después de OAuth, el usuario no ve su nombre, avatar, ni datos de perfil de Fanvue en ningún lado.

### F2. No hay media upload en creación de posts
- El dialog "Create Post" tiene selector de tipo (photo/video) pero no hay input de archivo ni upload.

### F3. No hay input de precio para PPV
- El selector "Pay-Per-View" en Create Post no permite setear un precio.

### F4. No se pueden editar ni eliminar posts
- Solo create. No hay edit ni delete.

### F5. No hay búsqueda en messages
- No se puede buscar en el historial de mensajes.

### F6. No hay notificaciones/toasts para acciones
- Después de sync, create post, send message — no hay feedback visual (toast).

### F7. Period selector en Analytics no funciona
- Los botones `7d`, `30d`, `3m`, `12m` cambian estado pero no filtran datos.

### F8. No hay export de datos (CSV/PDF)
- Los insights no se pueden exportar.

### F9. No hay configuración de notificaciones
- No hay preferencias de notificaciones para el usuario.

### F10. No hay date range picker en dashboard
- El dashboard solo muestra un snapshot. No se puede comparar períodos.

### F11. Connection section muestra info técnica que el user no necesita
- Muestra "PKCE", los scopes completos, y detalles de implementación OAuth que confunden al usuario final.

### F12. No hay onboarding flow
- Primer acceso: va directo al dashboard vacío sin guía de cómo usar la app.

---

## 🟢 MEJORAS UX/UI (6)

### U1. Favicon emoji es poco profesional
- `data:image/svg+xml` con emoji ⚡. Necesita un SVG/LPNG proper.

### U2. Dark mode hardcodeado en HTML
- `layout.tsx`: `<html className="dark">` + `defaultTheme="dark"` causa que el light mode toggle tenga flash.

### U3. Empty states sin ilustraciones ni CTAs
- Las secciones sin datos muestran texto plano. Necesitan ilustraciones y call-to-action.

### U4. Sidebar no muestra badge de secciones con actividad
- No hay indicadores de unread messages, new discoveries, etc. en la sidebar.

### U5. No hay responsive breakpoints intermedios
- Los layouts saltan de mobile (1 col) a desktop (4 cols) sin transición para tablets.

### U6. Loading states son solo spinners
- Debería haber skeleton loaders que muestren la estructura de la data que viene.

---

## 🔐 SEGURIDAD (5)

### S1. No hay rate limiting en API routes
- El proxy Fanvue y el chat endpoint no tienen rate limiting. Alguien puede spamear.

### S2. No hay CSRF protection en POST endpoints
- Los endpoints POST no verifican tokens CSRF.

### S3. Error messages exponen detalles internos
- Varios catch blocks retornan `error.message` directo al cliente. Puede exponer stack traces o rutas internas.

### S4. No hay validación de input en chat
- El `/api/chat` acepta cualquier array de messages sin sanitizar.

### S5. Cookies OAuth sin domain restrict
- Las cookies `fanvue_code_verifier` y `fanvue_oauth_state` no tienen `domain` restrict. En producción con custom domain, podrían ser accesibles desde subdominios.

---

## 📋 ROADMAP DE MEJORAS (Priorizado)

### FASE 1 — Blockers de Producción (inmediato)
1. ✅ Hacer GitHub token/repo optional (no crash)
2. ✅ Persistencia de tokens (Vercel KV o cookies encriptadas)
3. ✅ sync-fanvue debe guardar datos, no solo loggear
4. ✅ sync manual debe funcionar de verdad
5. ✅ AELIANA debe recibir datos reales como contexto

### FASE 2 — Conectar Datos Reales (corto plazo)
6. Analytics: reemplazar mock data con fetch real
7. Dashboard overview: timeline real de actividad
8. Discoveries: conectar al store poblado por sync-repo
9. Repo browser: conectar al GitHub API real
10. User profile: mostrar datos del creator conectado

### FASE 3 — Funcionalidad Completa (mediano plazo)
11. Media upload en posts
12. Edit/delete posts
13. Búsqueda en messages
14. Paginación en todas las listas
15. Export CSV/PDF
16. Toast notifications
17. Date range picker en analytics

### FASE 4 — UX Polish (mediano plazo)
18. Code splitting con dynamic imports
19. Skeleton loaders
20. Error boundaries por sección
21. Onboarding flow
22. Proper favicon/branding
23. Responsive tablet breakpoints

### FASE 5 — Seguridad y Performance (largo plazo)
24. Rate limiting en API routes
25. CSRF protection
26. Input sanitization
27. Tree-shake componentes unused
28. Audit de bundle size

---

**Conclusión**: La app está bien construida como prototipo visual. La UI es limpia, la estructura de componentes es correcta, y el OAuth flow está bien implementado. Pero como producto funcional, está al ~20% — solo conecta a Fanvue y mostra datos que no persiste. Las mejoras críticas son: persistencia de tokens y que el sync realmente guarde datos para que los dashboards puedan consumirlos.
