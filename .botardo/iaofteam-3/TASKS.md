# Tareas — iaofteam-3

## Prioridad CEO
- [ ] Aplicar fixes críticos de la auditoría (HB#57)
- [x] CEO decide qué mejorar primero → Fase 1 en progreso

## Completados (HB#59)
- [x] Fix B1: GITHUB_TOKEN optional con graceful fallback
- [x] Fix B3: sync-fanvue guarda datos en db.syncedData
- [x] Fix B4: sync manual ejecuta fetch real a Fanvue API
- [x] Fix B8: AELIANA recibe datos reales como contexto
- [x] Fix A1: Code splitting con dynamic imports
- [x] Fix A2: aeliana.ts ahora usado por /api/chat
- [x] TypeScript: todos error:any → error:unknown
- [x] Nuevo endpoint: /api/sync-data

## Pendientes
- [ ] Fix B2: Persistencia de tokens (Vercel KV o cookies encriptadas)
- [ ] Fix B5-B7: Conectar analytics/overview a datos reales del sync
- [ ] Fix B6: Conectar Discoveries/Tasks a datos reales
- [ ] Fix A4: Eliminar FanvueClient muerto o usarlo en sync
- [ ] Fix A5: Error boundaries por sección
- [ ] Fix A6: Paginación en listas
- [ ] Fix A7: Tree-shake shadcn components no usados
- [ ] Fix F6: Toast notifications para acciones
- [ ] Fix S1: Rate limiting en API routes
