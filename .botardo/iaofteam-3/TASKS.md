# RALPH LOOP — Tareas iaofteam-3
**Modo**: RALPH LOOP ACTIVADO (CEO directive 2026-04-19)
**Regla**: Cada ciclo toma la proxima tarea pendiente, la ejecuta, commitea, pushea. Sin descanso.

---

## FASE 6: P0 — Fixes Criticos de API (HB#70 spec)

- [x] P0-1: Agregar `X-Fanvue-API-Version: 2025-06-26` header a TODAS las llamadas Fanvue API ✅ RALPH-01
  - Archivo: `src/lib/fanvue.ts` — agregar constante `FANVUE_API_VERSION`
  - Archivo: `src/app/api/fanvue/[...endpoint]/route.ts` — GET, POST, DELETE headers
  - Archivo: `src/app/api/crons/sync-fanvue/route.ts` — fanvueFetch headers
  - Archivo: `src/app/api/sync/route.ts` — performFanvueSync headers
  - Spec: output/HB70-p0-implementation-spec.md Issue #1

- [x] P0-2: Corregir `FANVUE_API_BASE` — remover `/v1` prefix ✅ RALPH-02
  - Archivo: `src/lib/fanvue.ts` line 8
  - Cambiado de `https://api.fanvue.com/v1` a `https://api.fanvue.com`
  - Evidencia: OpenAPI spec servers, llms.txt, SDK examples — ninguno usa /v1
  - Versioning ahora via header (P0-1), no URL prefix
  - Spec: output/HB70-p0-implementation-spec.md Issue #2

- [x] P0-3: Agregar PATCH handler al Fanvue proxy ✅ RALPH-03
  - Archivo: `src/app/api/fanvue/[...endpoint]/route.ts`
  - Rate limiting (30/min) + CSRF + error sanitization
  - JSON body con robust text→JSON fallback
  - Habilita: complete-upload-session, update-post, update-chat
  - Spec: output/HB70-p0-implementation-spec.md Issue #4

- [x] P0-4: Crear endpoint `/api/fanvue/upload/route.ts` para 3-step media upload ✅ RALPH-04
  - POST: crear upload session (POST /media/uploads) — input validation, rate limit 10/min
  - GET: obtener presigned URL (GET /media/uploads/{id}/parts/{n}/url) — query param validation, rate limit 60/min
  - PATCH: completar session (PATCH /media/uploads/{id}) — parts array validation, rate limit 10/min
  - CSRF en POST y PATCH. Zod-free validation inline. Zero any.
  - Spec: output/HB70-p0-implementation-spec.md Issue #3

- [x] P0-5: Rewrite media upload en content-section.tsx — 3-step presigned URL flow ✅ RALPH-05
  - Nuevo `uploadMediaFile()`: 3-step (create session → chunked S3 upload → complete)
  - Chunks de 10MB, paralelismo 3 chunks, retry 3 veces con exponential backoff
  - Upload directo a S3 (no pasa por nuestro server)
  - Progreso por chunk (per-chunk + per-file combined)
  - MAX_FILE_SIZE: 500MB (antes 10MB)
  - Soporta audio + document ademas de image + video
  - Removido multipart handling del proxy POST handler
  - ETag parsing con quote removal
  - Sonner toasts para cada error
  - Spec: output/HB70-p0-implementation-spec.md Issue #3

- [ ] P0-6: Crear endpoint `/api/webhooks/fanvue/route.ts`
  - POST handler con HMAC-SHA256 signature verification
  - 5 event types: message-received, message-read, new-follower, new-subscriber, tip-received
  - Almacenar eventos en DB para actualizaciones real-time
  - Env var: FANVUE_WEBHOOK_SECRET

- [ ] P0-7: Verificar build clean despues de P0-1 a P0-6
  - `npm run build` — 0 errores TypeScript
  - Verificar que todas las secciones del dashboard funcionan

## FASE 7: P1 — Features de Alta Prioridad

- [ ] P1-1: Fan Insights panel
  - Usar GET /insights/fan-insights/{fanId} para perfil individual
  - Usar GET /insights/top-spenders para ranking de fans
  - Mostrar: total gastado, subscripcion activa, frecuencia de mensajes, LTV estimado
  - Nueva seccion o tab dentro de Messages

- [ ] P1-2: Earnings mejorado con datos reales
  - GET /insights/earnings — grafico de ganancias por periodo
  - GET /insights/earnings-summary — resumen agregado
  - GET /insights/spending — reembolsos/chargebacks
  - Graficos interactivos (bar chart por dia, line chart tendencia)

- [ ] P1-3: Mass Messaging
  - POST /chat-messages/mass — enviar a lista de fans
  - GET /chat-messages/mass — listar mensajes masivos enviados
  - DELETE /chat-messages/mass/{id} — eliminar
  - UI: seleccionar fans, escribir mensaje, preview, enviar

- [ ] P1-4: Smart Lists
  - GET /chat-smart-lists — obtener listas inteligentes
  - GET /chat-smart-lists/{id}/members — ver miembros
  - UI: panel de listas con conteo de miembros, filtro por lista

- [ ] P1-5: Custom Lists CRUD
  - GET /chat-custom-lists — listar
  - POST /chat-custom-lists — crear
  - PATCH /chat-custom-lists/{id} — renombrar
  - DELETE /chat-custom-lists/{id} — eliminar
  - POST /chat-custom-lists/{id}/members — agregar
  - DELETE /chat-custom-lists/{id}/members/{userId} — remover
  - UI: CRUD completo con drag-and-drop para reordenar

## FASE 8: P2 — Feature Parity vs Competidores

- [ ] P2-1: Post Pinning
  - POST /posts/{uuid}/pin — pin post
  - DELETE /posts/{uuid}/pin — unpin
  - Icono de pin en cards de posts

- [ ] P2-2: Repost Content
  - POST /posts/{uuid}/repost — repostear
  - Boton de repost en cards

- [ ] P2-3: Post Comments
  - GET /posts/{uuid}/comments — listar comentarios
  - POST /posts/{uuid}/comments — crear comentario
  - UI: seccion de comentarios debajo de cada post

- [ ] P2-4: Post Likes
  - GET /posts/{uuid}/likes — ver likes
  - Contador de likes real en cards

- [ ] P2-5: Post Tips
  - GET /posts/{uuid}/tips — ver tips de un post
  - Mostrar total de tips ganados por post

- [ ] P2-6: Vault Folders
  - GET /agency/creators/{id}/vault-folders — listar
  - POST para crear folders
  - UI: navegador de vault con folders

- [ ] P2-7: Tracking Links
  - GET /tracking-links — listar links
  - GET /tracking-links/{id}/users — ver usuarios por link
  - UI: tabla de links con metricas (clicks, conversiones, revenue)

- [ ] P2-8: Subscriber Count en Dashboard
  - GET /insights/subscribers — conteo actual
  - Widget en dashboard overview

- [ ] P2-9: Bulk Fan Insights
  - GET /insights/bulk-fan-insights — insights de multiples fans
  - Tabla con datos agregados

- [ ] P2-10: Chat Media
  - GET /chats/{id}/media — media compartida en chat
  - GET /chat-messages/{id}/media — resolver media UUIDs
  - Gallery de media en cada conversacion

## FASE 9: P3 — Features Avanzadas

- [ ] P3-1: AI Fan Profiles (usando AELIANA + insights API)
  - Analizar historial de chat + datos de insights
  - Generar perfil psicologico: estilo comunicacion, triggers emocionales, patrones de gasto
  - Mostrar en sidebar del chat
  - Opcion de "Ask AI about this fan"

- [ ] P3-2: A/B Testing para Mass Messages
  - Enviar variante A a 50% y variante B a 50%
  - Rastrear open rates y conversiones por variante
  - Mostrar ganador con estadisticas

- [ ] P3-3: Scheduled Posts
  - UI para programar publicacion futura
  - Queue de posts programados
  - Preview antes de publicar

- [ ] P3-4: Chat Templates
  - GET /chat-templates — listar templates
  - GET /chat-templates/{id} — ver template
  - UI: selector de templates en chat, quick-insert

- [ ] P3-5: Real-time Notifications (webhook-driven)
  - WebSocket o SSE para notificaciones push
  - Badge de unread en sidebar
  - Sonido/visual alert en nuevo mensaje
  - Toast de nuevo subscriber/tip

- [ ] P3-6: Advanced Analytics Dashboard
  - Filtros por periodo (7d, 30d, 90d, custom)
  - Comparacion periodo anterior (YoY, MoM)
  - Export CSV/PDF
  - Day-of-week heat map

## FASE 10: UX/UI Polish

- [ ] UX-1: Responsive mobile completo
  - Verificar TODAS las secciones en viewport mobile (375px)
  - Hamburger menu en mobile
  - Cards apiladas en mobile
  - Tablas con scroll horizontal

- [ ] UX-2: Dark mode consistente
  - Verificar todos los componentes en dark mode
  - Variables CSS para theming
  - Toggle dark/light en sidebar

- [ ] UX-3: Loading skeletons en todas las secciones
  - Skeleton para posts, chats, analytics, insights
  - Transicion suave loading → data

- [ ] UX-4: Empty states mejorados
  - Ilustraciones SVG para cada empty state
  - CTAs contextuals (create first post, send first message, etc.)

- [ ] UX-5: Keyboard shortcuts
  - Cmd+K para search global
  - Cmd+N para nuevo post
  - Escape para cerrar dialogs
  - Navegacion con flechas en listas

- [ ] UX-6: Breadcrumbs y navegacion
  - Breadcrumbs en secciones anidadas
  - Boton "Back" en chat detail
  - URL state para deep linking

- [ ] UX-7: Animaciones y transiciones
  - Framer Motion para page transitions
  - Stagger animations en listas
  - Micro-interactions en botones y cards

- [ ] UX-8: Accessibility (a11y)
  - ARIA labels en todos los controles
  - Focus trap en modals
  - Screen reader support
  - Keyboard navigation completa
  - Color contrast verification

## FASE 11: Performance

- [ ] PERF-1: Implementar ISR o SWR para datos del dashboard
  - stale-while-revalidate para datos que cambian poco
  - Reducir waterfalls de fetch

- [ ] PERF-2: React.memo y useMemo donde sea necesario
  - Memoizar componentes de lista pesados
  - Memoizar datos derivados (filtered/sorted lists)

- [ ] PERF-3: Virtualized lists para chats y posts
  - react-window o similar para listas largas
  - Lazy rendering de items fuera del viewport

- [ ] PERF-4: Image optimization
  - next/image para todas las imagenes
  - Lazy loading
  - Blur placeholder

- [ ] PERF-5: Bundle analysis
  - @next/bundle-analyzer
  - Identificar y eliminar dependencias innecesarias
  - Code splitting agresivo

- [ ] PERF-6: Prefetching estrategico
  - prefetch rutas probables (next/link)
  - preload datos de secciones adyacentes

## FASE 12: Security Hardening

- [ ] SEC-1: Content Security Policy headers
  - CSP en next.config.ts
  - Permitir solo dominios necesarios

- [ ] SEC-2: Rate limiting mejorado
  - Rate limiting por user (no solo por IP)
  - Redis/KV backing para distribuido

- [ ] SEC-3: Input sanitization avanzado
  - DOMPurify para contenido HTML
  - Zod schemas en todos los endpoints

- [ ] SEC-4: Audit logging
  - Log de todas las acciones sensibles (delete, update, upload)
  - Rotacion de logs

- [ ] SEC-5: API key rotation
  - UI para regenerar API key
  - Graceful period para rotacion

## FASE 13: Code Quality

- [ ] CODE-1: Zod schemas para todas las API responses
  - Validar respuestas de Fanvue API
  - Type-safe parsing

- [ ] CODE-2: Unit tests para funciones criticas
  - lib/fanvue.ts — token management
  - lib/rate-limit.ts — rate limiting
  - lib/security.ts — CSRF y sanitization

- [ ] CODE-3: E2E tests para flujos principales
  - Login flow
  - Create post
  - Send message
  - Media upload

- [ ] CODE-4: Error boundary granularity
  - Error boundary por feature (no solo por seccion)
  - Retry buttons en error states

- [ ] CODE-5: ESLint strict + Prettier
  - Zero warnings
  - Consistent formatting

- [ ] CODE-6: JSDoc en todas las funciones exportadas
  - Documentacion de parametros y return types
  - Ejemplos de uso

## FASE 14: Integraciones

- [ ] INT-1: Integracion con Fanvue MCP
  - Probar `pip install fanvue-mcp`
  - Documentar como conectar con Claude/Cursor
  - Crear guia para creadores

- [ ] INT-2: n8n workflow templates
  - Template: auto-reply a nuevos subscribers
  - Template: notificar en Discord on new tip
  - Template: sync analytics diario a Google Sheets

- [ ] INT-3: Stripe/payment notifications
  - Trackear pagos y reembolsos
  - Alertas de chargebacks

## FASE 15: DevOps

- [ ] DEV-1: Vercel deployment pipeline
  - Preview deployments en PRs
  - Auto-deploy en main
  - Environment variables management

- [ ] DEV-2: Monitoring y alertas
  - Vercel Analytics
  - Error tracking (Sentry?)
  - Uptime monitoring

- [ ] DEV-3: Database backup strategy
  - Periodic backup de datos sync
  - Migration scripts

---

## Progreso RALPH LOOP
| Fase | Total | Done | % |
|------|-------|------|---|
| FASE 6 (P0) | 7 | 5 | 71% |
| FASE 7 (P1) | 5 | 0 | 0% |
| FASE 8 (P2) | 10 | 0 | 0% |
| FASE 9 (P3) | 6 | 0 | 0% |
| FASE 10 (UX) | 8 | 0 | 0% |
| FASE 11 (Perf) | 6 | 0 | 0% |
| FASE 12 (Sec) | 5 | 0 | 0% |
| FASE 13 (Code) | 6 | 0 | 0% |
| FASE 14 (Int) | 3 | 0 | 0% |
| FASE 15 (DevOps) | 3 | 0 | 0% |
| **TOTAL** | **59** | **5** | **8%** |

---

## Completados (Fases 1-5)
- [x] Fase 1: Bugs criticos (B1-B8) — HB#59
- [x] Fase 2: Dashboards con datos reales (B5-B7, A4) — HB#60
- [x] Fase 3: Token persistence (B2) — HB#61
- [x] Fase 4: Security (S1-S4) — HB#63
- [x] Fase 5: UX (A5-A7, F6) + Funcionalidad (F3-F5) + Media Upload (F2) — HB#62-66
