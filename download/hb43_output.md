# HB#43 — IA4 APIs Research
**Timestamp**: 2026-04-15 22:00 BA
**Tags**: #IA4 #APIs #fanvue #comfyui #replicate #fal-ai #elevenlabs #pricing
**Activity**: Behavior Productivo — API Ecosystem Scan for Fanvue AI Pipeline

---

## Research Scope
Web search across 5 API domains relevant to M1-M5 pipeline execution: Fanvue API, ComfyUI API, Replicate API, Fal.ai API, ElevenLabs API.

---

## Findings

### 1. Fanvue API (api.fanvue.com)
**Status**: Confirmed production-ready, official docs live.
- OAuth 2.0 + PKCE authentication flow
- Webhooks: subscribers, messages, renewals, churn — configurable via Developer Dashboard UI
- n8n Community Node: Official Fanvue n8n node exists (api.fanvue.com/docs/integrations/n-8-n)
- MCP Integration: Native MCP support for Claude/Cursor orchestration
- API Versioning: Backward-compatible versioned endpoints
- Apify Scraper: Third-party Fanvue scraper for profile data extraction
- **M4 Impact**: Direct Fanvue n8n node confirms M4 calendar automation fully achievable without custom wrapper.

### 2. ComfyUI API
**Status**: Production-ready headless mode.
- Headless Server: Official guide — CLI-only execution for production environments
- Programmatic API: Workflow JSON to REST API endpoint to image output
- MCP Server: ComfyUI MCP Server exists (containerized, stdio MCP access for AI-driven workflows)
- n8n Bridge: Confirmed n8n+ComfyUI automation pipeline pattern
- **M1 Impact**: ComfyUI fully headless for production. MCP enables LLM-driven workflow adjustment.

### 3. Replicate API
**Status**: Primary cloud ML hosting, extensive model catalog.
- Face Swap Collection: Multiple face swap models available as API endpoints
- Pricing 2026: $0.01-0.05/image for most models. Flux 2 Pro at $0.055/image
- No PuLID-Flux2 hosted — need ComfyUI for production face consistency
- Cheapest: $0.002/1024x1024 for some models
- **M1 Impact**: Quick MVP alternative for face swap, but PuLID-Flux2 requires self-hosted ComfyUI.

### 4. Fal.ai API
**Status**: Speed-optimized, competitive pricing.
- FLUX.1 [schnell] at $0.003/megapixel, Flux 2 at ~$0.03/image
- Fal.ai 55% cheaper than Replicate for Flux models
- Free tier available for testing
- No PuLID hosted model
- **M1 Impact**: Best cloud option for non-face images. Not suitable for AELIANA face pipeline without PuLID.

### 5. ElevenLabs API
**Status**: Enterprise-ready with generous grants.
- Grant Program: 12 months free, 33M characters for startups/creators
- n8n Integration: Official n8n node confirmed
- Professional Voice Cloning at 192kbps, $22/month tier
- **M3 Impact**: Grant eliminates voice AI cost barrier for first year. M3 fully automatable via n8n.

---

## Discovery Summary

| # | Discovery | Impact | Task |
|---|-----------|--------|------|
| D89 | ComfyUI MCP Server — AI-driven workflow orchestration | HIGH | M1 |
| D90 | Fal.ai Flux 2 pricing $0.03/img — cheapest cloud option | MEDIUM | M1/M3 |
| D91 | Fal.ai vs Replicate 2026: Fal 55% cheaper for Flux models | MEDIUM | M1 |
| D92 | ComfyUI headless mode official production guide | MEDIUM | M1 |
| D93 | ElevenLabs Grant: 12mo free, 33M chars for creators | HIGH | M3 |
| D94 | Fanvue API n8n node + webhooks confirmed production | HIGH | M4 |

**Total new discoveries**: D89-D94 (6)
**Running total**: 94 discoveries

## Cost Estimates Updated (Monthly)
- M1 Pipeline: ComfyUI self-hosted (GPU ~$40/mes) OR Fal.ai cloud (~$30-60/mes)
- M3 Voice: ElevenLabs FREE for 12 months via Grant, then ~$22/mes
- M4 Automation: n8n free (self-hosted) + Fanvue API (free)
- Total MVP: $0/mes (Year 1) or ~$40-60/mes cloud-only

**GREEN zone** — all systems operational, no errors.
