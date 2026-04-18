# Fanvue Ops — Handoff (iaofteam-3)

## Estado Actual
- **Repo**: `iaofteam-crypto/fanvue-dashboard`
- **Plataforma**: Next.js 16 + Vercel (Hobby)
- **Alcance**: Dashboard para operaciones de creador Fanvue

## Auditoría Completa (HB#57 — 2026-04-18)
- 38 problemas encontrados en 5 categorías
- 8 bugs críticos, 7 arquitectura, 12 funcionalidad, 6 UX, 5 seguridad
- Ver output/audit_critica-app-HB57.md para detalle completo

## Issues Críticos Pendientes
1. GITHUB_TOKEN/GITHUB_REPO crashan en cold start si no están seteados
2. In-memory store pierde tokens en cada cold start de Vercel
3. sync-fanvue descarta los datos que obtiene (no persiste)
4. sync manual es fake (solo crea logs)
5. Analytics, Discoveries, Tasks son 100% mock data
6. AELIANA no recibe contexto de datos reales

## Entregables Previos (sesiones anteriores)
- OAuth2 PKCE flow completo y funcional
- Fanvue API proxy (GET/POST dinamico)
- AELIANA chat con z-ai-web-dev-sdk
- Crons diarios configurados para Hobby plan
- Prisma eliminado, reemplazado con in-memory KV store
- 7+ bugs menores corregidos (loading stuck, cache headers, dead code)

## Variables de Entorno Vercel
- FANVUE_CLIENT_ID
- FANVUE_CLIENT_SECRET
- FANVUE_REDIRECT_URI (https://fanvue-dashboard.vercel.app/api/fanvue/callback)
- (Opcional) KV_REST_API_URL + KV_REST_API_TOKEN para persistencia
- (Opcional) GITHUB_TOKEN + GITHUB_REPO para repo browser
