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

- [x] P0-6: Crear endpoint `/api/webhooks/fanvue/route.ts` ✅ RALPH-06
  - POST handler con HMAC-SHA256 signature verification (X-Fanvue-Signature: t={ts},v0={hmac})
  - 5 event types: message-received, message-read, new-follower, new-subscriber, tip-received
  - In-memory event store (200 max, newest first)
  - GET polling endpoint con ?since= timestamp + ?type= filter (max 50 per response)
  - Timestamp tolerance 300s anti-replay, timing-safe comparison
  - Event payload validation per type, rate limit 120/min POST + 60/min GET
  - Exported getStoredEvents() / getStoredEventById() para SSE/polling interno
  - Env var: FANVUE_WEBHOOK_SECRET (required)
  - Spec: output/HB70-p0-implementation-spec.md Missing Feature #1

- [x] P0-7: Verificar build clean despues de P0-1 a P0-6 ✅ RALPH-06
  - `npm run build` — 0 errores TypeScript ✅
  - 17 routes verificados (incluye /api/webhooks/fanvue)
  - Solo 3 pre-existing @vercel/kv dynamic import warnings (sin cambio)

## FASE 7: P1 — Features de Alta Prioridad

- [x] P1-1: Fan Insights panel ✅ RALPH-07
  - Nuevo componente: `src/components/dashboard/fan-insights-section.tsx`
  - Top Spenders ranking (via GET /api/fanvue/insights/top-spenders) con demo fallback
  - Fan Detail View (via GET /api/fanvue/insights/fan-insights/{fanId}) con 4 stat cards
  - Shows: total spent, estimated LTV, message count/frequency, engagement score
  - Subscription details: status, tier, duration, start date
  - Spending breakdown: subs vs tips vs PPV con progress bars
  - Activity timeline: last active, first active, frequency
  - Sort by revenue/messages/recent, search filter, rank badges (1st/2nd/3rd)
  - 10 demo fans con datos realistas, code-split via dynamic import
  - Nuevo nav item "Fan Insights" con icono Users en sidebar
  - Spec: output/HB69-ia3-api-deep-dive.md Insights endpoints

- [x] P1-2: Earnings mejorado con datos reales ✅ RALPH-08
  - Fetch directo: GET /api/fanvue/insights/earnings + earnings-summary + spending (paralelo via Promise.allSettled)
  - Fallback a /api/sync-data para subscribers y engagement
  - Period selector funcional: 7d/30d/90d/12m con filtro real (no solo label)
  - Period-over-period change % (compara vs periodo anterior)
  - 3 tabs: Earnings, Spending, Engagement
  - Earnings: daily bar chart + trend line chart + stacked area (subs/tips/PPV) + revenue breakdown bars
  - Spending: refunds + chargebacks table con status badges, deduction rate, summary cards
  - Engagement: pie chart + key metrics bars
  - Custom tooltip con currency formatting
  - Nuevo componente: src/components/ui/tabs.tsx (shadcn-compatible)
  - Demo data: 30 daily earnings points, 12 monthly, 7 spending records
  - Net earnings calculation (gross - refunds - chargebacks)

- [x] P1-3: Mass Messaging ✅ RALPH-09
  - Nuevo componente: `src/components/dashboard/mass-messaging-section.tsx`
  - Fetch smart lists: GET /api/fanvue/chats/lists/smart (4 built-in: all_fans, subscribers, expired_subscribers, top_spenders)
  - Fetch custom lists: GET /api/fanvue/chats/lists/custom
  - Send mass message: POST /api/fanvue/chats/mass-messages (text + mediaUuids + price + includedLists/excludedLists)
  - List history: GET /api/fanvue/chat-messages/mass
  - Delete mass message: DELETE /api/fanvue/chat-messages/mass/{id}
  - List member preview: GET /api/fanvue/chats/lists/smart/{id} o /custom/{uuid}
  - UI: 2 tabs (Compose/History), list selector con checkboxes, message composer, media UUID attachments, PPV price, exclusion lists, preview panel, confirmation dialog, history cards con status badges + delete
  - Validation: min $2 PPV, media required for PPV, max 10 media, max 5000 chars
  - Nuevo nav item "Mass Message" con icono Megaphone en sidebar
  - Code-split via dynamic import, demo data fallback
  - Zero any, error:unknown, Sonner toasts

- [x] P1-4: Smart Lists ✅ RALPH-10
  - Nuevo componente: `src/components/dashboard/smart-lists-section.tsx`
  - Fetch smart lists: GET /api/fanvue/chats/lists/smart
  - Fetch members: GET /api/fanvue/chats/lists/smart/{listId}?page=&size=
  - 4 built-in smart lists: all_fans, subscribers, expired_subscribers, top_spenders (con iconos y colores unicos)
  - Overview: grid de cards con descripcion, member count, badge "Auto"
  - Detail view: click into list → member list con stats bar (total members, total spend, active subs, avg engagement)
  - Member rows: avatar, name, sub badge (Crown VIP/Standard), expired badge, message count, total spend, last active, engagement score bar
  - Sort by name/spent/recent/engagement
  - Search members
  - Pagination (20 per page, numbered buttons)
  - Quick Insights panel: 4 stat boxes con member counts por lista
  - Demo data fallback: 20 realistic members per page, totals por lista
  - Nuevo nav item "Smart Lists" con icono ListFilter en sidebar
  - Code-split via dynamic import. Zero any, error:unknown, Sonner toasts

- [x] P1-5: Custom Lists CRUD ✅ RALPH-11
  - Nuevo componente: `src/components/dashboard/custom-lists-section.tsx`
  - GET /api/fanvue/chats/lists/custom — listar listas custom
  - POST /api/fanvue/chats/lists/custom — crear lista (name + description)
  - PATCH /api/fanvue/chats/lists/custom/{uuid} — renombrar lista
  - DELETE /api/fanvue/chats/lists/custom/{uuid} — eliminar lista (con confirmacion)
  - POST /api/fanvue/chats/lists/custom/{uuid}/members — agregar miembro (por userId)
  - DELETE /api/fanvue/chats/lists/custom/{uuid}/members/{memberId} — remover miembro (con confirmacion)
  - GET /api/fanvue/chats/lists/custom/{uuid} — ver miembros de lista
  - UI: 2 views (overview grid + detail members). Overview: cards con nombre, descripcion, member count, fecha, hover actions (view/rename/delete), search. Create form inline. Rename inline (input + Enter/Esc). Delete confirmation destructive. Detail: member list con avatar, sub badge, msgs, spend, last active, addedAt, remove con confirmacion. Add member form (input userId). Info banner (Custom vs Smart lists). Summary footer.
  - Demo data: 4 lists, 5 members por lista
  - Nuevo nav item "Custom Lists" con icono FolderOpen en sidebar
  - Code-split via dynamic import. Zero any, error:unknown, Sonner toasts
  - **FASE 7 (P1) 100% COMPLETA** ✅

## FASE 8: P2 — Feature Parity vs Competidores

- [x] P2-1: Post Pinning ✅ RALPH-12
  - POST /api/fanvue/posts/{uuid}/pin — pin post
  - DELETE /api/fanvue/posts/{uuid}/pin — unpin post
  - Modificado content-section.tsx: agregado isPinned a Post interface, handleTogglePin (POST/DELETE via proxy)
  - Pin icon (Pin/PinOff) en cada post card, con loading state
  - Badge "Pinned" con icono Pin en cards de posts pinned
  - Sort: pinned posts always first (antes de createdAt desc)
  - Demo data: post "Day in my life" marcado como pinned
  - Color: pin button active en primary, inactive en muted
  - Sonner toasts para feedback

- [x] P2-2: Repost Content ✅ RALPH-13
  - POST /api/fanvue/posts/{uuid}/repost — repostear
  - DELETE /api/fanvue/posts/{uuid}/repost — deshacer repost
  - Modificado content-section.tsx: agregado isReposted + repostsCount a Post interface
  - handleRepost: toggle POST/DELETE via catch-all proxy con optimistic update
  - Boton repost (Repeat2 icon) en cada post card con loading spinner
  - Color emerald-500 cuando esta repostado, muted cuando no
  - Contador de reposts visible en cada card
  - Demo data: repostsCount en todos los posts demo (18, 7, 34, 52, 0)
  - Sonner toasts para feedback

- [x] P2-3: Post Comments ✅ RALPH-14
  - GET /api/fanvue/posts/{uuid}/comments — listar comentarios (via catch-all proxy)
  - POST /api/fanvue/posts/{uuid}/comments — crear comentario (via catch-all proxy)
  - Modificado content-section.tsx: Comment interface, expandedPostId state, commentsMap cache
  - handleToggleComments: expandir/colapsar seccion de comentarios en cada card
  - handlePostComment: enviar comentario nuevo con Enter o boton Send
  - UI: click en contador de comentarios → expande panel con lista + input
  - Comentarios: avatar con inicial, nombre, fecha, texto, likes count
  - Input: h-7 compacto con Send button, Enter para enviar
  - Max-height 48 con scroll para lista de comentarios
  - Demo comments: generados determinísticamente por postId (1-5 comentarios por post)
  - ChevronDown/ChevronUp indica estado expandido/colapsado
  - Sonner toasts. Zero any, error:unknown

- [x] P2-4: Post Likes ✅ RALPH-15
  - GET /api/fanvue/posts/{uuid}/likes — ver lista de likers (via catch-all proxy)
  - POST /api/fanvue/posts/{uuid}/likes — like post (via catch-all proxy)
  - DELETE /api/fanvue/posts/{uuid}/likes — unlike post (via catch-all proxy)
  - Modificado content-section.tsx: isLiked agregado a Post interface
  - handleToggleLike: toggle POST/DELETE con optimistic update del counter
  - Heart icon reemplaza Eye para likes — rose-500 fill cuando liked, muted cuando no
  - Click en contador de likes → Dialog con lista de likers (handleViewLikes)
  - Likes Dialog: avatar con inicial, nombre, max-h-64 scrollable, loading state
  - Demo likers: generados deterministicamente por postId (3-10 por post)
  - Sonner toasts. Zero any, error:unknown

- [x] P2-5: Post Tips ✅ RALPH-16
  - GET /api/fanvue/posts/{uuid}/tips — ver tips de un post (via catch-all proxy)
  - tipsTotal agregado a Post interface
  - handleViewTips: fetch tips → Dialog con lista de tips
  - Tips Dialog: avatar DollarSign amber, nombre, monto en emerald-500, mensaje, fecha
  - Header del dialog: cantidad de tips + total en Badge
  - Boton DollarSign + total en post cards (solo visible si tipsTotal > 0), color amber-500
  - Demo tips: generados deterministicamente por postId (1-4 tips por post)
  - Sonner toasts. Zero any, error:unknown

- [x] P2-6: Vault Folders ✅ RALPH-17
  - GET /vault/folders — listar folders (via catch-all proxy)
  - POST /vault/folders — crear folder
  - PATCH /vault/folders/{id} — renombrar folder
  - DELETE /vault/folders/{id} — eliminar folder
  - GET /vault/folders/{id}/media — listar media en folder
  - POST /vault/folders/{id}/media — agregar media a folder (attach)
  - DELETE /vault/folders/{id}/media/{mediaUuid} — remover media (detach)
  - Nuevo componente: `src/components/dashboard/vault-folders-section.tsx`
  - 2 views (overview grid + detail media gallery)
  - Overview: stats bar (folders, total media, images, videos), create form inline, cards con hover actions (rename/delete), search, delete confirmation destructive
  - Detail: media grid 5-column responsive (image/video/audio/document), type badge, duration badge para video, hover overlay con remove button, add media form (input UUID), media type filter counts, back navigation
  - Rename inline (Enter/Esc). Delete confirmation destructive. Detach media confirmation.
  - Demo data: 5 folders, 12 media items (images, videos, audio, document)
  - Nuevo nav item "Vault" con icono Vault en sidebar
  - Code-split via dynamic import. Zero any, error:unknown, Sonner toasts

- [x] P2-7: Tracking Links ✅ RALPH-18
  - GET /tracking-links — listar links (via catch-all proxy)
  - GET /tracking-links/{id}/users — ver usuarios por link
  - POST /tracking-links — crear tracking link
  - DELETE /tracking-links/{id} — eliminar tracking link
  - Nuevo componente: `src/components/dashboard/tracking-links-section.tsx`
  - 2 views (overview table + detail users)
  - Overview: stats bar (clicks, conversions, revenue, subscribers), create form (name + destination + source), table con columnas (link, clicks, conv%, revenue, subs, actions), source badges con colores por plataforma (instagram pink, twitter sky, tiktok violet, youtube red, reddit orange, email emerald), copy link button, delete con confirmacion, search
  - Detail: stats del link seleccionado (4 cards), tabla de usuarios (user, clicks, converted badge sub/yes, spent, last visit), back navigation
  - Demo data: 6 links, 8 usuarios
  - Nuevo nav item "Tracking" con icono Link2 en sidebar
  - Code-split via dynamic import. Zero any, error:unknown, Sonner toasts

- [x] P2-8: Subscriber Count en Dashboard ✅ RALPH-19
  - GET /insights/subscribers — conteo actual via catch-all proxy
  - Modificado `dashboard-overview.tsx`: nuevo `fetchSubscriberInsights()` en paralelo con fetchStats
  - SubscriberInsights interface: total, active, expired, growthRate, newThisMonth, churnedThisMonth, avgSubscriptionLength, tiers
  - Subscriber card mejorado: muestra active/expired/new/churned en 2x2 grid dentro del card cuando datos disponibles
  - Nuevo Subscriber Insights widget debajo de stat cards: 4 metricas (active con progress bar, new con growth rate, expired con churn, avg subscription length), tiers breakdown con badges
  - Preferencia de datos: dedicated insights API > sync-data fallback
  - Sonner toasts. Zero any, error:unknown

- [x] P2-9: Bulk Fan Insights ✅ RALPH-20
  - GET /insights/fans/bulk — insights de multiples fans (via catch-all proxy)
  - Nuevo componente: `src/components/dashboard/bulk-fan-insights-section.tsx`
  - 2 views: tabla principal (14 columnas) + detalle de fan seleccionado
  - Tabla: rank, fan (avatar+nombre), total spent, LTV, engagement score (badge con color), mensajes, tips, PPV, tier (VIP amber/STD sky), risk badge (Active/Recent/Cooling/Cold), last active
  - Sort por cualquier columna (toggle asc/desc) — spent, LTV, engagement, msgs, tips, PPV, last active
  - Filter por tier: All, Active, Expired, VIP
  - Search por nombre/username/id
  - 5 stat cards resumen: total fans, total revenue, avg engagement, VIP count, at-risk count
  - Risk scoring: dias inactivo → Active (0d emerald), Recent (1-2d sky), Cooling (3-5d amber), Cold (5d+ red)
  - Engagement score badges con color por rango (80+ emerald, 60+ sky, 40+ amber, <40 red)
  - Detail view: 4 stat cards + spending breakdown bars (subs/tips/PPV) + preferences panel
  - Export CSV con headers y datos filtrados
  - Demo data: 15 fans con datos realistas (gasto, LTV, engagement, riesgo, tier)
  - Nuevo nav item "Bulk Insights" con icono UsersRound en sidebar
  - Code-split via dynamic import. Zero any, error:unknown, Sonner toasts

- [x] P2-10: Chat Media ✅ RALPH-21
  - GET /chats/{id}/media — media compartida en chat (via catch-all proxy)
  - GET /chat-messages/{id}/media — resolver media UUIDs (via catch-all proxy)
  - Modificado `messages-section.tsx`: nuevo Media tab en chat detail view
  - Toggle Messages/Media en chat header con media count badge
  - Media gallery grid responsive (2-5 columnas) con gradientes por tipo
  - Type badges: image (sky), video (violet), audio (amber), document (emerald)
  - Duration badge para video/audio, size badge, type icon en cada card
  - Filter por tipo: All/Images/Video/Audio/Docs con counters
  - Search por filename o sender name
  - Media detail view: metadata panel (sender, shared date, size, UUID, dimensions, mime type)
  - Preview placeholder con gradiente e icono por tipo
  - Summary footer con counts por tipo
  - resolveMessageMedia() helper para resolver UUIDs por mensaje
  - Media count badges en chat list items (inbox)
  - Demo data: 5 chats con 15 media items totales (images, videos, audio, PDFs)
  - Zero any, error:unknown, Sonner toasts
  - **FASE 8 (P2) 100% COMPLETA** ✅

## FASE 9: P3 — Features Avanzadas

- [x] P3-1: AI Fan Profiles ✅ RALPH-22
  - Analizar historial de chat + datos de insights (via /api/chat endpoint con mode "analyst")
  - Generar perfil psicologico: estilo comunicacion, triggers emocionales, patrones de gasto
  - Modificado `messages-section.tsx`: nuevo tab "AI Profile" en chat detail (Messages/Media/AI Profile)
  - fetchAIProfile(): POST /api/chat con prompt estructurado para generar JSON con 7 campos (communicationStyle, emotionalTriggers, spendingPattern, engagementLevel, personalityTraits, recommendations, riskFactors)
  - JSON parsing con regex fallback del response
  - Profile display: 6 secciones con iconos y colores (Communication sky, Traits amber, Triggers rose, Spending emerald, Engagement violet, Recommendations emerald, Risk red)
  - Personality traits como badges, emotional triggers como bullet list
  - Risk Factors en card rojo con AlertTriangle icon
  - Refresh button para regenerar perfil
  - "Ask AI about this fan" section: input + chat history con respuestas via /api/chat
  - Demo profiles: 2 perfiles deterministicos por fan name length
  - Demo AI responses cuando /api/chat no disponible
  - Sonner toasts. Zero any, error:unknown

- [x] P3-2: A/B Testing para Mass Messages ✅ RALPH-23
  - Nuevo componente: `src/components/dashboard/ab-testing-section.tsx`
  - 3 views: test list, create form, test detail with results
  - Create: nombre, split ratio (50/50, 60/40, 70/30, etc.), target lists (smart + custom), variant A (text + media + PPV), variant B (text + media + PPV)
  - Launch: envia variantes A y B como mass messages separados via POST /api/fanvue/chats/mass-messages con tag [A/B Test]
  - Metrics tracking: sent, opened, clicked, replied, converted, revenue, tips, ppvPurchases por variante
  - Comparison: 12 metric bars lado a lado (sent, opened, open rate, clicked, click rate, replied, reply rate, converted, conversion rate, revenue, tips, ppv purchases) con colores sky (A) y violet (B)
  - 4 metric cards: open rate, conversion rate, revenue, replies
  - Winner declaration con confidence score (% basado en sample size + conversion difference)
  - Winner banner con Trophy icon, variant-highlighted cards con border color del ganador
  - Actions: pause/resume, complete, duplicate, delete, copy variant text
  - Status badges: draft, running (spinner), paused, completed
  - Demo: 3 tests (2 completed con winners, 1 running) con datos generados deterministicamente
  - Nuevo nav item "A/B Testing" con icono FlaskConical en sidebar
  - Code-split via dynamic import. Zero any, error:unknown, Sonner toasts

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
| FASE 6 (P0) | 7 | 7 | 100% |
| FASE 7 (P1) | 5 | 5 | 100% |
| FASE 8 (P2) | 10 | 10 | 100% |
| FASE 9 (P3) | 6 | 2 | 33% |
| FASE 10 (UX) | 8 | 0 | 0% |
| FASE 11 (Perf) | 6 | 0 | 0% |
| FASE 12 (Sec) | 5 | 0 | 0% |
| FASE 13 (Code) | 6 | 0 | 0% |
| FASE 14 (Int) | 3 | 0 | 0% |
| FASE 15 (DevOps) | 3 | 0 | 0% |
| **TOTAL** | **59** | **24** | **41%** |

---

## Completados (Fases 1-5)
- [x] Fase 1: Bugs criticos (B1-B8) — HB#59
- [x] Fase 2: Dashboards con datos reales (B5-B7, A4) — HB#60
- [x] Fase 3: Token persistence (B2) — HB#61
- [x] Fase 4: Security (S1-S4) — HB#63
- [x] Fase 5: UX (A5-A7, F6) + Funcionalidad (F3-F5) + Media Upload (F2) — HB#62-66
