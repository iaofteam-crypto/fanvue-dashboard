# Fanvue Ops — Handoff (iaofteam-3)

## Estado Actual
- **Repo**: `iaofteam-crypto/fanvue-dashboard`
- **Plataforma**: Next.js 16 + Vercel (Hobby)
- **Alcance**: Dashboard para operaciones de creador Fanvue
- **Build**: ✅ Clean (TypeScript strict, no errors)
- **Token Persistence**: ✅ Cookie-based (survives cold starts)

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

## Discovery: Fanvue API Full Map (HB#67)
- **llms.txt**: https://api.fanvue.com/docs/llms.txt — 70+ endpoints documented
- **OpenAPI 3.1**: https://api.fanvue.com/openapi.json (auth required)
- **Media upload is 3-step presigned URL flow** (not multipart POST)
  1. POST /v1/media/upload-session → session ID
  2. GET /v1/media/upload-session/:id/part-url → presigned S3 URL
  3. PUT to presigned URL, then POST /v1/media/upload-session/:id/complete
- **Undocumented features available**: Webhooks (6 events), Mass Messages, Smart Lists, Custom Lists, Vault Folders, Tracking Links, MCP Integration, Post pin/repost/comments, Chat Templates, Bulk Fan Insights
- **Vercel Fluid Compute**: Automatic cold start optimization on Hobby plan
- **F2 media upload needs rewrite** to use presigned URL pattern

## Variables de Entorno Vercel
- FANVUE_CLIENT_ID
- FANVUE_CLIENT_SECRET
- FANVUE_REDIRECT_URI (https://fanvue-dashboard.vercel.app/api/fanvue/callback)
- (Opcional) KV_REST_API_URL + KV_REST_API_TOKEN para persistencia KV
- (Opcional) GITHUB_TOKEN + GITHUB_REPO para repo browser

## Log
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
