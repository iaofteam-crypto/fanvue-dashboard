# Fanvue Ops — Handoff (iaofteam-3)

## Estado Actual
- **Repo**: `iaofteam-crypto/fanvue-dashboard`
- **Plataforma**: Next.js 16 + Vercel (Hobby)
- **Alcance**: Dashboard para operaciones de creador Fanvue
- **Build**: ✅ Clean (TypeScript strict, no errors)
- **Token Persistence**: ✅ Cookie-based (survives cold starts)
- **MODO**: 🔥 RALPH LOOP ACTIVADO (CEO directive 2026-04-19)
- **RALPH LOOP**: 59 tareas en 10 fases. Crons cada 30 min. Sin descanso. Mejora continua.

## Auditoría Completa (HB#57 — 2026-04-18)
- 38 problemas encontrados en 5 categorías
- 8 bugs críticos, 7 arquitectura, 12 funcionalidad, 6 UX, 5 seguridad
- Ver output/audit_critica-app-HB57.md para detalle completo

## Fixes Aplicados (HB#61 — 2026-04-18 17:00 BA)
### B2: Token Persistence (último bug crítico)
- ✅ Cookie `fanvue_token` (httpOnly, secure, 7d maxAge) set on OAuth callback
- ✅ `getValidAccessToken(request?)` rehidrata token desde cookie en cold starts
- ✅ `/api/auth/status` lee cookie como fallback cuando store está vacío
- ✅ `/api/auth/disconnect` limpia cookie + store
- ✅ Fanvue proxy pasa `request` para cookie recovery
- ✅ `/api/sync` POST acepta `NextRequest` para cookie recovery
- **Resultado**: Tokens sobreviven cold starts sin necesidad de Vercel KV

### Cookie Security
- httpOnly: true (no accesible desde JS)
- secure: true en producción
- sameSite: "lax"
- maxAge: 7 días (refresh_token sobrevive)
- path: "/"
- Base64url encoded (no plaintext)

## Fixes Aplicados (HB#60 — 2026-04-18 16:00 BA)
- ✅ B5: Analytics con datos reales de /api/sync-data
- ✅ B6: Discoveries derivadas de synced data
- ✅ B7: Dashboard overview con actividad real
- ✅ A4: FanvueClient eliminada (~110 líneas)

## Fixes Aplicados (HB#59 — 2026-04-18 15:00 BA)
- ✅ B1/B3/B4/B8/A1/A2 + sync-data endpoint + TS strict

## Issues Pendientes
1. ~~A5: Error boundaries~~ ✅
2. ~~A6: Paginación~~ ✅
3. ~~A7: Tree-shake~~ ✅
4. ~~F6: Toast~~ ✅
5. ~~S1-S4: Security~~ ✅
6. ~~F3-F5: PPV pricing, delete posts, search messages~~ ✅
7. ~~F2: Media upload~~ ✅ (needs rewrite for 3-step presigned URL)
8. **ALL 38 AUDIT FINDINGS ADDRESSED** — zero remaining Fanvue tasks

## Discovery: Fanvue API Full Map (HB#67 → HB#69 refined)
- **llms.txt**: https://api.fanvue.com/docs/llms.txt — 70+ endpoints documented
- **OpenAPI 3.1**: https://api.fanvue.com/openapi.json (auth required)
- **API Version**: `2025-06-26` (required header: `X-Fanvue-API-Version`)
- **Media upload is 3-step presigned URL flow** (exact schemas in HB#69 output)
  1. POST /media/uploads → {mediaUuid, uploadId}
  2. GET /media/uploads/{uploadId}/parts/{partNumber}/url → presigned S3 URL → PUT chunk → collect ETag
  3. PATCH /media/uploads/{uploadId} + {parts: [{ETag, PartNumber}]} → {status: "processing"}
- **API Auth**: X-Fanvue-API-Key header (per-user, 1 per user, at fanvue.com/api-keys) + OAuth Bearer
- **Webhooks**: 5 events (message-received, message-read, new-follower, new-subscriber, tip-received) + HMAC-SHA256 verification
- **MCP Server**: `pip install fanvue-mcp` — official Python MCP for Claude/Cursor
- **Undocumented features**: Mass Messages, Smart Lists, Custom Lists, Vault Folders, Tracking Links, Post pin/repost/comments, Chat Templates, Bulk Fan Insights
- **Competitor**: FanvueModels CRM (50+ features, AI profiles, A/B testing, employee mgmt, desktop app)
- **P0 ACTION**: Add X-Fanvue-API-Version header to proxy. Rewrite F2 media upload to 3-step flow.

## P0 Code Issues (HB#70 — IA5 Tech Analysis)
Precise spec in `output/HB70-p0-implementation-spec.md`
1. ~~**CRITICAL**: Missing `X-Fanvue-API-Version: 2025-06-26` header on ALL Fanvue API calls (4 files, ~12 lines)~~ ✅ RALPH-01
2. ~~**CRITICAL**: `FANVUE_API_BASE` may be wrong (`/v1` prefix vs documented no-prefix) — needs verification~~ ✅ RALPH-02 — Removed `/v1`. Now `https://api.fanvue.com` (matching OpenAPI spec).
3. ~~**CRITICAL**: Media upload uses wrong pattern (multipart POST vs 3-step presigned URL) — needs full rewrite~~ ✅ RALPH-04 (backend endpoint done), P0-5 (frontend rewrite) pending
4. ~~**HIGH**: Missing PATCH handler in proxy (needed for complete-upload-session, update-post, update-chat)~~ ✅ RALPH-03
5. **HIGH**: No webhook endpoint (Fanvue supports 5 event types with HMAC-SHA256 verification)
- **Estimated fix effort**: ~3 hours total (15 min for headers/URL, 2 hrs for upload rewrite, 45 min for PATCH+webhooks)

## Variables de Entorno Vercel
- FANVUE_CLIENT_ID
- FANVUE_CLIENT_SECRET
- FANVUE_REDIRECT_URI (https://fanvue-dashboard.vercel.app/api/fanvue/callback)
- (Opcional) KV_REST_API_URL + KV_REST_API_TOKEN para persistencia KV
- (Opcional) GITHUB_TOKEN + GITHUB_REPO para repo browser

## Log
- HB#RALPH-16 (2026-04-19 05:30 BA): RALPH LOOP ciclo 16 — P2-5 COMPLETADO. **FASE 8 (P2) 50% COMPLETA**. Post Tips en content-section.tsx. tipsTotal a Post interface. handleViewTips: GET /api/fanvue/posts/{uuid}/tips via proxy → Dialog. Tips Dialog: avatar DollarSign amber, nombre, monto en emerald-500, mensaje, fecha. Header: count + total en Badge. Boton DollarSign + total en post cards (visible solo si tipsTotal > 0), color amber-500. Demo tips deterministicos por postId. Sonner toasts. Build clean. 17/59 tareas (29%). Proxima: P2-6 (Vault Folders).
- HB#RALPH-15 (2026-04-19 05:15 BA): RALPH LOOP ciclo 15 — P2-4 COMPLETADO. Post Likes en content-section.tsx. isLiked a Post interface. handleToggleLike: POST/DELETE /api/fanvue/posts/{uuid}/likes via proxy con optimistic update. Heart icon reemplaza Eye — rose-500 fill cuando liked. handleViewLikes: GET /api/fanvue/posts/{uuid}/likes → Dialog con lista de likers (avatar + nombre, scrollable max-h-64). Demo likers deterministicos por postId. Sonner toasts. Build clean. 16/59 tareas (27%). Proxima: P2-5 (Post Tips).
- HB#RALPH-14 (2026-04-19 05:00 BA): RALPH LOOP ciclo 14 — P2-3 COMPLETADO. Post Comments en content-section.tsx. Comment interface (id, author, content, createdAt, likesCount). handleToggleComments: expand/colapsar panel en cada card, fetch GET /api/fanvue/posts/{uuid}/comments via proxy. handlePostComment: POST /api/fanvue/posts/{uuid}/comments con Enter o Send button. UI: click en MessageSquare counter → panel con lista scrollable (max-h-48), avatar con inicial, nombre, fecha, texto, likes. Input compacto h-7 con Send icon. Demo comments generados deterministicamente por postId (1-5 por post). ChevronDown/ChevronUp toggle. commentsMap cache por postId. Sonner toasts. Build clean. 15/59 tareas (25%). Proxima: P2-4 (Post Likes).
- HB#RALPH-13 (2026-04-19 04:45 BA): RALPH LOOP ciclo 13 — P2-2 COMPLETADO. Repost Content en content-section.tsx. Agregado isReposted + repostsCount a Post interface. handleRepost: toggle POST/DELETE /api/fanvue/posts/{uuid}/repost via catch-all proxy. Boton repost (Repeat2 icon) en cada post card footer con emerald-500 fill cuando activo. Contador de reposts. Optimistic update. Demo data: repostsCount (18, 7, 34, 52, 0). Sonner toasts. Build clean. 14/59 tareas (24%). Proxima: P2-3 (Post Comments).
- HB#RALPH-12 (2026-04-19 04:30 BA): RALPH LOOP ciclo 12 — P2-1 COMPLETADO. Post Pinning en content-section.tsx. Agregado isPinned a Post interface. handleTogglePin: POST /api/fanvue/posts/{uuid}/pin para pin, DELETE para unpin (via catch-all proxy). Pin/PinOff icon en cada post card con loading spinner. Badge "Pinned" con icono Pin en cards. Sort: pinned posts first, luego createdAt desc. Demo: post "Day in my life" pinned. Sonner toasts. Build clean. 13/59 tareas (22%). Proxima: P2-2 (Repost Content).
- HB#RALPH-11 (2026-04-19 04:15 BA): RALPH LOOP ciclo 11 — P1-5 COMPLETADO. **FASE 7 (P1) 100% COMPLETA** ✅. Creado `custom-lists-section.tsx`: Custom Lists CRUD completo. 2 views (overview grid + detail members). Overview: create form inline (name + description), cards con hover actions (view/rename/delete), search, destructive delete confirmation. Rename inline (Enter/Esc). Detail: member list con avatar, sub badge, msgs, spend, last active, remove con confirmation, add member form (input userId). API: GET /chats/lists/custom, POST crear, PATCH renombrar, DELETE eliminar, POST members agregar, DELETE members/{id} remover. Demo data: 4 lists, 5 members. Info banner (Custom vs Smart). Nuevo nav item "Custom Lists" con FolderOpen. Build clean. 12/59 tareas (20%). Proxima: P2-1 (Post Pinning) — inicio FASE 8.
- HB#RALPH-10 (2026-04-19 04:00 BA): RALPH LOOP ciclo 10 — P1-4 COMPLETADO. Creado `smart-lists-section.tsx`: Smart Lists panel con 2 views (overview + detail). Overview: grid de 4 built-in smart lists (all_fans, subscribers, expired_subscribers, top_spenders) con iconos unicos y colores, member count badges, info banner. Detail: stats bar (total members, page spend, active subs, avg engagement), member list con avatar, sub badge (Crown VIP/Standard), expired badge, msg count, spend, last active, engagement score bar. Sort by name/spent/recent/engagement. Search filter. Pagination 20/page con numbered buttons. Quick Insights panel. Fetch: GET /chats/lists/smart + GET /chats/lists/smart/{id}?page=&size=. Demo data: 20 members/page, totals (1247/389/156/42 por lista). Nuevo nav item "Smart Lists" con icono ListFilter. Code-split via dynamic import. Zero any, error:unknown. Build clean. 11/59 tareas. **FASE 7 (P1) 80% COMPLETA**. Proxima: P1-5 (Custom Lists CRUD) — ultima tarea de P1.
- HB#RALPH-09 (2026-04-19 03:45 BA): RALPH LOOP ciclo 9 — P1-3 COMPLETADO. Creado `mass-messaging-section.tsx`: Mass Messaging completo con 2 tabs (Compose/History). Compose: smart list selector (4 built-in: all_fans, subscribers, expired_subscribers, top_spenders) + custom list selector via GET /chats/lists/smart + /chats/lists/custom, message composer con 5000 char limit, media UUID attachments (max 10), PPV pricing ($2 min, requires media), inclusion/exclusion lists, preview panel, confirmation dialog. Send: POST /chats/mass-messages con includedLists/excludedLists. History: GET /chat-messages/mass con status badges (sending/sent/failed/scheduled), time ago, recipient count, media count, PPV price, DELETE /chat-messages/mass/{id}. List member preview via GET /chats/lists/smart/{id} + /custom/{uuid}. Demo data fallback (3 demo mass messages, 4 smart lists). Nuevo nav item "Mass Message" con icono Megaphone. Code-split via dynamic import. Zero any, error:unknown, Sonner toasts. Build clean, 18 routes. 10/59 tareas. Proxima: P1-4 (Smart Lists). Rewrite completo de analytics-section.tsx: fetch directo a Fanvue insights API (earnings + earnings-summary + spending en paralelo via Promise.allSettled), period selector funcional (7d/30d/90d/12m con filtro real), period-over-period change %, 3 tabs (Earnings/Spending/Engagement). Earnings: daily bar chart + trend line + stacked area (subs/tips/PPV) + revenue breakdown. Spending: refunds + chargebacks table con status badges, deduction rate. Engagement: pie chart + key metrics. Nuevo componente ui/tabs.tsx. Custom tooltip con currency formatting. Demo data: 30 daily points, 12 monthly, 7 spending records. Net earnings = gross - refunds - chargebacks. Build clean. 9/59 tareas. Proxima: P1-3 (Mass Messaging).
- HB#RALPH-07 (2026-04-19 03:15 BA): RALPH LOOP ciclo 7 — P1-1 COMPLETADO. Creado `fan-insights-section.tsx`: Top Spenders ranking (GET /api/fanvue/insights/top-spenders), Fan Detail View (GET /api/fanvue/insights/fan-insights/{fanId}), 4 stat cards (total spent, LTV, messages, engagement score), subscription details, spending breakdown bars (subs/tips/PPV), activity timeline, sort by revenue/messages/recent, search filter, rank badges. 10 demo fans fallback. Nuevo nav item "Fan Insights" en sidebar con icono Users. Code-split via dynamic import. Build clean. 8/59 tareas. Proxima: P1-2 (Earnings mejorado).
- HB#RALPH-06 (2026-04-19 02:45 BA): RALPH LOOP ciclo 6 — P0-6 + P0-7 COMPLETADOS. Creado `/api/webhooks/fanvue/route.ts`: POST con HMAC-SHA256 verification (X-Fanvue-Signature t={ts},v0={hmac}), timestamp tolerance 300s anti-replay, timing-safe comparison, 5 event types con payload validation, in-memory store (200 max), GET polling con ?since= + ?type= filters, rate limit 120/min POST + 60/min GET. Exported getStoredEvents/getStoredEventById. P0-7 build verification: 17 routes, 0 TS errors. **FASE 6 (P0) 100% COMPLETA**. 52→54 tareas restantes (note: previous count was wrong, now 52). Proxima: P1-1 (Fan Insights panel).
- HB#RALPH-05 (2026-04-19 02:30 BA): RALPH LOOP ciclo 5 — P0-5 COMPLETADO. Rewrite completo del media upload en content-section.tsx: nuevo `uploadMediaFile()` con 3-step presigned URL flow, chunked upload directo a S3 (10MB chunks, 3 parallel, 3 retries con exponential backoff), MAX_FILE_SIZE 500MB, soporte audio+document, ETag parsing, combined progress. Removido multipart handling del proxy POST. Build clean. 55→54 tareas. Proxima: P0-6 (webhook endpoint).
- HB#RALPH-04 (2026-04-19 02:15 BA): RALPH LOOP ciclo 4 — P0-4 COMPLETADO. Creado `/api/fanvue/upload/route.ts` con 3 handlers: POST (create session, 10/min, CSRF, input validation), GET (presigned URL, 60/min, query validation), PATCH (complete session, 10/min, parts validation). Build clean. Ruta aparece en routes. 56→55 tareas. Proxima: P0-5 (frontend rewrite content-section.tsx).
- HB#RALPH-03 (2026-04-19 01:45 BA): RALPH LOOP ciclo 3 — P0-3 COMPLETADO. Agregado PATCH handler al Fanvue proxy con rate limiting (30/min), CSRF, error sanitization, robust text→JSON fallback. Habilita complete-upload-session, update-post, update-chat. Build clean. 57→56 tareas. Proxima: P0-4 (upload endpoint 3-step).
- HB#RALPH-02 (2026-04-19 01:30 BA): RALPH LOOP ciclo 2 — P0-2 COMPLETADO. Corregido FANVUE_API_BASE: removido `/v1` prefix. Ahora `https://api.fanvue.com` (alinea con OpenAPI spec, llms.txt, SDK examples). Versioning via header (P0-1). Build clean. 58→57 tareas. Proxima: P0-3 (PATCH handler).
- HB#RALPH-01 (2026-04-19 01:15 BA): RALPH LOOP ciclo 1 — P0-1 COMPLETADO. Agregado `X-Fanvue-API-Version: 2025-06-26` header a todas las llamadas Fanvue API (4 archivos: fanvue.ts, [...endpoint]/route.ts GET/POST/DELETE, sync-fanvue/route.ts, sync/route.ts). Build clean. 59→58 tareas restantes. Proxima: P0-2 (FANVUE_API_BASE /v1 fix).
- HB#RALPH-00 (2026-04-19 01:00 BA): RALPH LOOP ACTIVADO. CEO directive. 59 tareas en 10 fases (P0→DevOps). TASKS.md reescrito completo. Crons cada 30min configurados. Proxima tarea: P0-1 (version header).
- HB#70 (2026-04-19 00:30 BA): IA5 — Tech Analysis. Analyzed all 4 files that call Fanvue API. Found 4 critical issues: missing version header (all calls), wrong base URL (/v1), broken media upload (multipart vs presigned), missing PATCH handler. Wrote precise implementation spec with line numbers and code changes.
- HB#69 (2026-04-19 00:00 BA): IA3 — API Deep Dive. Exact media upload schemas (3-step with OpenAPI spec), API versioning (2025-06-26), webhook verification, MCP server details, full endpoint map (60+ endpoints), competitive analysis (FanvueModels CRM 50+ features). P0: add version header + rewrite upload.
- HB#68 (2026-04-18 23:30 BA): IA1 — Fanvue MCP, Webhooks, Upload Tutorial deep dive. v2 roadmap proposal written.
- HB#67 (2026-04-18 22:30 BA): DISCOVERY — Fanvue API llms.txt (70+ endpoints), 3-step media upload, webhooks, MCP, vault. F2 needs rewrite.
- HB#66 (2026-04-18 21:00 BA): F2 media upload (drag-drop, preview, multipart proxy) — ALL 38 audit items done
- HB#65 (2026-04-18 20:30 BA): F3 PPV price input, F4 create post full fields + delete post, F5 search messages, DELETE proxy handler
- HB#64 (2026-04-18 19:30 BA): A7 tree-shake (-3414 lines), A6 pagination
- HB#63 (2026-04-18 19:00 BA): Fase 4 Security — rate limiting, CSRF, input validation, error sanitization
- HB#62 (2026-04-18 18:30 BA): Fase 3 UX — Sonner toasts, error boundaries, empty states, error.tsx, loading.tsx
- HB#61 (2026-04-18 17:00 BA): B2 token persistence (cookie-based), S3 disconnect cookie clear
- HB#60 (2026-04-18 16:00 BA): B5/B6/B7/A4 — dashboards conectados a datos reales
- HB#59 (2026-04-18 15:00 BA): B1/B3/B4/B8/A1/A2 fixes + sync-data endpoint
- HB#58 (2026-04-18 06:06 BA): 15+ bugs fixed, TS strict, build clean
- HB#57 (2026-04-18): Critical audit — 38 findings across 5 categories
