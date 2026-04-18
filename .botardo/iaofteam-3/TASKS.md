# Tareas — iaofteam-3

## Prioridad CEO
- [x] Aplicar fixes críticos de la auditoría (HB#57) — Fase 1 completa
- [x] Conectar dashboards a datos reales — Fase 2 completa

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
- [ ] Fix B2: Persistencia de tokens (Vercel KV o cookies encriptadas)
- [ ] Fix A5: Error boundaries por sección
- [ ] Fix A6: Paginación en listas
- [ ] Fix A7: Tree-shake shadcn components no usados
- [ ] Fix F6: Toast notifications para acciones
- [ ] Fix S1: Rate limiting en API routes
- [ ] Fix F2: Media upload en posts
- [ ] Fix F3-F5: PPV pricing, edit/delete posts, search messages
