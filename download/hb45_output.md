# HB#45 — IA5 Tech Analysis: Video AI Pipeline
**Timestamp**: 2026-04-16 12:00 BA
**Tags**: #IA5 #tech_analysis #video #runway #kling #n8n #M3 #api #pricing
**Activity**: Behavior Productivo — Video AI deep dive for M3

---

## Research Scope
Technical comparison of video AI generation platforms for M3 (video AI pipeline for AELIANA). Focus: API availability, pricing, character consistency, and n8n integration.

---

## Platform Analysis

### 1. Runway Gen-4 / Gen-4 Turbo

**Status**: Production-ready, industry leader.

- **Character Consistency**: Single reference image generates consistent characters across lighting, locations, treatments — directly relevant for AELIANA face consistency
- **Resolution**: 720p default, upscaling to 4K on paid plans
- **API Access**: Available through Runway API ($0.05-0.15/second depending on tier/resolution)
- **Pricing Plans**: Free (limited), Standard ($12/mes), Pro ($28/mes), Unlimited ($76/mes)
- **Gen-4 Turbo**: Faster generation, same quality
- **Comparison**: Competitive with Sora 2 and Seedance 2.0 in quality

**M3 Impact**: Runway Gen-4 is the best option for face-consistent video generation. Single image reference = perfect for AELIANA pipeline. API available for n8n integration.

### 2. Kling AI (Kuaishou)

**Status**: Production-ready, open-weight available.

- **Speed**: One of the fastest video generators on the market
- **Kling 2.0**: Native audio-visual synchronization, video subject creation, improved reference consistency
- **API**: Reverse-engineered API available (klingCreator by yihong0618) — unofficial but functional
- **Open Source**: Best open-source option for self-hosted video generation
- **Free Tier**: Available with generous limits (one of 8 best free AI video generators 2026)

**M3 Impact**: Best free/open-source option. Can self-host for zero marginal cost. However, face consistency may not match Runway Gen-4's single-image reference system.

### 3. Comparison Matrix

| Feature | Runway Gen-4 | Kling 2.0 | Sora 2 | Seedance 2.0 |
|---------|-------------|-----------|--------|-------------|
| Face consistency | HIGH (single ref) | MEDIUM | HIGH | MEDIUM |
| API access | Official | Unofficial | Official | Official |
| Price/sec | $0.05-0.15 | Free (self-host) | ~$0.10 | ~$0.08 |
| Max resolution | 4K (upscale) | 1080p | 1080p | 720p |
| Speed | Medium | Fast | Slow | Medium |
| n8n integration | Via API | Via klingCreator | Via API | Via API |
| Audio sync | No | Native (v2.0) | No | No |

---

## n8n Video Automation Templates

- **POV Video Template**: Fully automated end-to-end POV video generation + multi-platform posting (n8n community, free)
- **ComfyUI + n8n**: Replicate API bridge for ComfyUI workflows — "eliminates need for self-hosting GPU"
- **Limitation**: ComfyUI + n8n limited to ~5 sec video clips — long video not possible via this route
- **10 Templates**: AI video automation templates cover 90% of video production workflows

**Key Insight**: For M3, the architecture should be:
1. Image generation (ComfyUI + PuLID) → face-consistent frames
2. Video generation (Runway Gen-4 API or Kling) → animate frames
3. Voice (ElevenLabs API) → audio track
4. Assembly (n8n) → combine video + audio + post to Fanvue

---

## Discovery Summary

| # | Discovery | Impact | Task |
|---|-----------|--------|------|
| D100 | Runway Gen-4 single-image face consistency for video | HIGH | M3 |
| D101 | Runway API $0.05-0.15/sec, 4K upscale available | MEDIUM | M3 |
| D102 | Kling 2.0 native audio-visual sync (unique) | HIGH | M3 |
| D103 | Kling open-source + klingCreator unofficial API | MEDIUM | M3 |
| D104 | ComfyUI+n8n limited to 5sec clips — long video needs dedicated API | MEDIUM | M3 |
| D105 | n8n POV video template — full automated pipeline exists | MEDIUM | M3 |

**Total new discoveries**: D100-D105 (6)
**Running total**: 105 discoveries

---

## M3 Architecture Update

Based on research, recommended M3 pipeline:

```
ComfyUI (PuLID + Flux.2) → Face-consistent image frames
    ↓
Runway Gen-4 API (or Kling 2.0) → Video animation (5-10s clips)
    ↓
ElevenLabs API → Voiceover (free via Grant)
    ↓
n8n (assembly + scheduling) → Combine + auto-post to Fanvue
```

**Cost estimate**:
- Runway Pro ($28/mes) + ElevenLabs Grant (free Year 1) + n8n (free self-hosted)
- **OR**: Kling self-hosted (free) + ElevenLabs Grant + n8n = **$0/mes**
- Recommended: Start with Kling (free) for MVP, upgrade to Runway Gen-4 for quality

**Timeline estimate**: M3 setup ~3-4 hours, fully automatable

**GREEN zone** — 105 total discoveries, no errors.
