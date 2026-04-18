# Tareas — iaofteam-3

## Prioridad CEO
- [x] Aplicar fixes críticos de la auditoría (HB#57) — Fase 1 completa
- [x] Conectar dashboards a datos reales — Fase 2 completa
- [x] Token persistence — Todos los bugs críticos resueltos
- [x] Fase 3 UX/Visual — Sonner toasts, error boundaries, empty states
- [x] Fase 4 Security — Rate limiting, CSRF, input validation, error sanitization

## Completados (HB#63)
- [x] S1: In-memory IP-based rate limiter (chat: 10/min, sync: 2/min, fanvue proxy: 60/min)
- [x] S2: CSRF origin check on all POST endpoints
- [x] S3: Error message sanitization (no internal leaks)
- [x] S4: Input validation on /api/chat (50 msg max, 4000 char max)
- [x] New lib/rate-limit.ts + lib/security.ts modules

## Completados (HB#62)
- [x] Fix A5: SectionErrorBoundary wrapping all 9 sections
- [x] Fix F6: Sonner toasts replacing inert Radix Toaster
- [x] Toast notifications in all 12 catch blocks
- [x] app/error.tsx global error page
- [x] app/loading.tsx loading spinner
- [x] Empty states improved: icon + description in all sections
- [x] Removed hardcoded className="dark" from <html>
- [x] Sync Now shows success/error toast feedback

## Completados (HB#61)
- [x] Fix B2: Token persistence con cookie httpOnly (cold start recovery)
- [x] Auth status lee cookie como fallback
- [x] Disconnect limpia cookie

## Completados (HB#60)
- [x] Fix B5: Analytics fetch desde /api/sync-data con demo fallback
- [x] Fix B6: Discoveries derivadas de synced data
- [x] Fix B7: Dashboard overview con actividad real del sync
- [x] Fix A4: Eliminada FanvueClient muerta (~110 líneas)

## Completados (HB#59)
- [x] Fix B1: GITHUB_TOKEN optional con graceful fallback
- [x] Fix B3: sync-fanvue guarda datos en db.syncedData
- [x] Fix B4: sync manual ejecuta fetch real a Fanvue API
- [x] Fix B8: AELIANA recibe datos reales como contexto
- [x] Fix A1: Code splitting con dynamic imports
- [x] Fix A2: aeliana.ts ahora usado por /api/chat
- [x] TypeScript: todos error:any → error:unknown
- [x] Nuevo endpoint: /api/sync-data

## Pendientes (prioridad)
- [ ] Fix A6: Paginación en listas
- [ ] Fix A7: Tree-shake shadcn components no usados
- [ ] Fix F2: Media upload en posts
- [ ] Fix F3-F5: PPV pricing, edit/delete posts, search messages
- [ ] Fase 5: Reliability (error boundaries already done, retry logic, health checks)
