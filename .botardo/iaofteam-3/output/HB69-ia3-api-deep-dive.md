# HB#69 — IA3: Fanvue API Deep Dive & Competitive Analysis
**Ciclo**: TICK_WORKER iaofteam-3
**Fecha**: 2026-04-19 00:00 BA
**Actividad**: IA3 — Investigate APIs (Fanvue API schemas, competitor landscape, implementation gaps)

---

## 1. Media Upload: Exact 3-Step Flow (OpenAPI Schemas)

The current `content-section.tsx` uses simple multipart POST passthrough. This is **wrong** — Fanvue requires a 3-step presigned URL flow.

### Step 1: Create Upload Session
```
POST https://api.fanvue.com/media/uploads
Headers:
  Authorization: Bearer {access_token}
  X-Fanvue-API-Version: 2025-06-26
  Content-Type: application/json

Body:
{
  "name": "photo.jpg",          // display name
  "filename": "photo.jpg",      // original filename
  "mediaType": "image"          // enum: "image" | "video" | "audio" | "document"
}

Response 200:
{
  "mediaUuid": "uuid-string",
  "uploadId": "upload-id-string"
}

Scope required: write:media
```

### Step 2: Get Presigned URL & Upload Part
```
GET https://api.fanvue.com/media/uploads/{uploadId}/parts/{partNumber}/url
Headers:
  Authorization: Bearer {access_token}
  X-Fanvue-API-Version: 2025-06-26

Response 200:
{
  "url": "https://s3.amazonaws.com/bucket/...?X-Amz-...",
  // The response returns a presigned S3 URL
}

Then PUT the file chunk directly to S3:
PUT {presigned_url}
Content-Type: application/octet-stream
Body: <file chunk bytes>
Response ETag header must be captured

Scope required: write:media
```

### Step 3: Complete Upload Session
```
PATCH https://api.fanvue.com/media/uploads/{uploadId}
Headers:
  Authorization: Bearer {access_token}
  X-Fanvue-API-Version: 2025-06-26
  Content-Type: application/json

Body:
{
  "parts": [
    { "PartNumber": 1, "ETag": "etag-from-s3-response" },
    { "PartNumber": 2, "ETag": "etag-from-s3-response" }
    // ... one entry per chunk
  ]
}

Response 200:
{
  "status": "processing"  // enum: "created" | "processing" | "ready" | "error"
}

Scope required: write:media
```

### Implementation Notes
- Recommended chunk size: 5-10MB per part
- Chunks can upload in parallel for better performance
- If one chunk fails, only that chunk needs retry
- Media URLs available once status transitions to "ready"
- Progress tracking is per-chunk (granular UX feedback)

### F2 Rewrite Plan
The current `content-section.tsx` sends files via `FormData` to `/api/fanvue/media/upload` which proxies as multipart. This must be replaced with:

1. **Client-side file splitting** (10MB chunks using `File.slice()`)
2. **Backend API route** (`/api/fanvue/upload/[action]`) that proxies the 3 Fanvue endpoints:
   - `POST /media/uploads` (create session)
   - `GET /media/uploads/{id}/parts/{n}/url` (get presigned URL)
   - `PATCH /media/uploads/{id}` (complete session)
3. **Client-side chunk upload loop**: request presigned URL from our backend → PUT chunk directly to S3 → collect ETags → complete session
4. **Progress bar** showing per-chunk upload progress
5. **Parallel upload** of up to 3 chunks simultaneously

---

## 2. API Versioning & Authentication Changes

### Critical: X-Fanvue-API-Version Header Required
All Fanvue API requests must include:
```
X-Fanvue-API-Version: 2025-06-26
```
Current version: `2025-06-26`. Without this header, requests will fail.

**Our proxy (`/api/fanvue/[...endpoint]/route.ts`) does NOT currently send this header.** This must be added to every Fanvue API call.

### API Key Authentication
Fanvue now supports `X-Fanvue-API-Key` header in addition to Bearer tokens:
- API Keys are per-user, non-transferable, one active key per user
- Obtained at `https://www.fanvue.com/api-keys`
- Keys are stored hashed and cannot be retrieved after creation
- Scopes are fixed at key creation time (cannot be modified)
- For OAuth apps (like ours), Bearer token from OAuth flow should still work
- API Keys may be needed for server-to-server scenarios

### Version Lifecycle
- Active → Deprecated → Sunset
- Deprecation communicated via RFC 8594 headers:
  - `Deprecation`: when deprecated
  - `Sunset`: when it stops working
  - `X-Fanvue-API-Next-Version`: recommended migration

---

## 3. Webhooks (5 Event Types)

Fanvue supports real-time webhooks with HMAC-SHA256 signature verification:

| Event | Trigger | Payload Key Fields |
|-------|---------|-------------------|
| `message-received` | New DM in creator inbox | messageUuid, message (uuid, text, hasMedia, createdAt) |
| `message-read` | Message read by user | messageUuid |
| `new-follower` | New follower | follower info |
| `new-subscriber` | New subscriber | subscriber info |
| `purchase-received` | Purchase event | purchase details |
| `tip-received` | Tip received | tip amount, sender info |

### Signature Verification
```
Header: X-Fanvue-Signature
Format: t={unix_timestamp},v0={hmac_sha256_hex}

Verification:
1. Extract t and v0 from header
2. Construct payload: "{timestamp}.{raw_body}"
3. Compute HMAC-SHA256 with FANVUE_WEBHOOK_SECRET
4. Timing-safe compare expected vs received signature
5. Optionally check timestamp within 5-minute window
```

Setup: Fanvue Developer Area → App → Webhooks tab → Enter URL → Enable

### Feature Gap
Our dashboard has **no webhook support**. Adding webhooks would enable:
- Real-time new message notifications (no polling needed)
- Instant new subscriber/follower alerts
- Live purchase/tip notifications
- Auto-sync trigger on events

---

## 4. MCP Integration (Official Python Server)

Fanvue has an official MCP server for AI assistants:
```bash
pip install fanvue-mcp
# or: uvx fanvue-mcp
```

Compatible with: Claude Desktop, Claude Code (VS Code), Cursor

Features:
- All Fanvue API endpoints exposed as MCP tools
- Natural language API operations ("Show my earnings", "Send message to user X")
- OAuth 2.0 handled automatically
- Environment variables: `FANVUE_CLIENT_ID`, `FANVUE_CLIENT_SECRET`

**Implication**: This means AI-native creator tools are a first-class use case for Fanvue. Our dashboard could integrate MCP-like AI features.

---

## 5. Complete API Endpoint Map (from llms.txt)

### Users
- `GET /users/me` — Get current user

### Chats (7 endpoints)
- `GET /chats` — List chats (paginated)
- `GET /chats/unread-count` — Unread count
- `GET /chats/{id}/media` — Chat media
- `POST /chats` — Create new chat
- `GET /chats/batch-statuses` — Online statuses (batch)
- `PATCH /chats/{id}` — Update chat properties

### Chat Messages (8 endpoints)
- `GET /chats/{id}/messages` — List messages (paginated)
- `GET /chat-messages/{id}/media` — Resolve media UUIDs
- `POST /chats/{id}/messages` — Send message
- `GET /chat-messages/mass` — List mass messages
- `POST /chat-messages/mass` — Send mass message
- `DELETE /chat-messages/mass/{id}` — Delete mass message
- `DELETE /chat-messages/{id}` — Delete message

### Chat Templates (2 endpoints)
- `GET /chat-templates` — List templates
- `GET /chat-templates/{id}` — Get template

### Smart Lists (2 endpoints)
- `GET /chat-smart-lists` — Get smart lists
- `GET /chat-smart-lists/{id}/members` — Get members

### Custom Lists (6 endpoints)
- `GET /chat-custom-lists` — List custom lists
- `GET /chat-custom-lists/{id}/members` — Get members
- `POST /chat-custom-lists` — Create list
- `PATCH /chat-custom-lists/{id}` — Rename
- `DELETE /chat-custom-lists/{id}` — Delete
- `POST /chat-custom-lists/{id}/members` — Add members
- `DELETE /chat-custom-lists/{id}/members/{userId}` — Remove member

### Posts (10 endpoints)
- `GET /posts` — List posts
- `GET /posts/{uuid}` — Get by UUID
- `GET /posts/{uuid}/tips` — Post tips
- `GET /posts/{uuid}/likes` — Post likes
- `GET /posts/{uuid}/comments` — Post comments
- `POST /posts` — Create post
- `PATCH /posts/{uuid}` — Update post
- `DELETE /posts/{uuid}` — Delete post
- `POST /posts/{uuid}/comments` — Create comment
- `POST /posts/{uuid}/repost` — Repost
- `POST /posts/{uuid}/pin` — Pin post
- `DELETE /posts/{uuid}/pin` — Unpin post

### Creators (2 endpoints)
- `GET /creators/followers` — List followers
- `GET /creators/subscribers` — List subscribers

### Insights (7 endpoints)
- `GET /insights/earnings` — Earnings data
- `GET /insights/earnings-summary` — Aggregated summary
- `GET /insights/spending` — Spending reversal data
- `GET /insights/top-spenders` — Top spending fans
- `GET /insights/subscribers` — Subscriber count
- `GET /insights/bulk-fan-insights` — Bulk fan insights
- `GET /insights/fan-insights` — Single fan insights

### Media (7 endpoints)
- `GET /media` — User media list
- `GET /media/bulk` — Bulk by UUIDs
- `GET /media/{uuid}` — By UUID
- `GET /media/{uuid}/entitled` — Entitled media
- `POST /media/{uuid}/grant` — Grant access
- `POST /media/uploads` — Create upload session
- `GET /media/uploads/{id}/parts/{n}/url` — Get presigned URL
- `PATCH /media/uploads/{id}` — Complete upload

### Tracking Links (2 endpoints)
- `GET /tracking-links` — List tracking links
- `GET /tracking-links/{id}/users` — Users per link

### Agency Endpoints (multi-creator management)
- Similar endpoints under `/agency/creators/{creatorId}/...`
- Upload sessions, posts, vault folders, etc.

---

## 6. Competitive Analysis

### FanvueModels CRM (fanvuemodels.com) — Direct Competitor
**Pricing**: Free (included with promo listing on their site)
**Platform**: Web + Desktop App (native)
**Sections**: 9+ dashboard sections, 50+ features

**Key Features We DON'T Have**:
1. **AI Psychological Profiles** — personality analysis, emotional triggers, spending patterns per fan
2. **PPV Tracking Per Fan** — purchase status, conversion rates, earned vs pending per fan
3. **Mass Messaging + A/B Testing** — broadcast to smart lists, split-test variants
4. **Employee Management** — invite chatters/managers with permissions, track per-employee metrics
5. **Vault Media Manager** — browse/upload/organize vault, create folders, manage pricing
6. **Tracking Link Attribution** — branded links per social platform, clicks/subscribers/revenue per link
7. **Multi-Account Management** — switch between multiple Fanvue creator accounts (agency feature)
8. **Real-Time Polling** — auto-poll messages every 5 seconds
9. **Fan Intelligence Sidebar** — 4-tab sidebar with spending, subscription, notes, AI analysis
10. **Desktop App** — native desktop application

**Our Advantages**:
1. **Open Source** — fully transparent, self-hostable
2. **AELIANA AI** — integrated AI chatbot (unique differentiator)
3. **Customizable** — can add any feature without vendor lock-in
4. **Security Hardened** — rate limiting, CSRF, input validation, error sanitization
5. **Cost Control** — free on Vercel Hobby, no subscription fees

### Apify Scrapers — Indirect Competitors
- `sentry/fanvue-scraper` — scrape creator profiles (no auth needed)
- `sentry/fanvue-search-scraper` — search creators by keyword
- These are data extraction tools, not management dashboards

---

## 7. Priority Action Items

### P0 — Critical (Breaking)
1. **Add `X-Fanvue-API-Version: 2025-06-26` header** to all Fanvue proxy calls
2. **Rewrite F2 media upload** to use 3-step presigned URL flow

### P1 — High Impact Features
3. **Webhook support** — real-time notifications for messages, subscribers, purchases
4. **Mass messaging** — `POST /chat-messages/mass` (broadcast to fans)
5. **Fan insights** — `GET /insights/fan-insights` + `GET /insights/top-spenders`

### P2 — Feature Parity with Competitors
6. **Vault folders** — `GET/POST /agency/creators/{id}/vault-folders`
7. **Tracking links** — `GET /tracking-links` (attribution per social platform)
8. **Smart lists & custom lists** — for targeted mass messaging
9. **Post pinning/reposting** — `POST /posts/{uuid}/pin`, `POST /posts/{uuid}/repost`

### P3 — Advanced Features
10. **AI fan profiles** — build psychological profiles using chat history + insights API
11. **A/B testing for mass messages** — split-test message variants
12. **Employee management** — multi-user with granular permissions

---

## 8. Source URLs
- Fanvue API Docs: https://api.fanvue.com/docs/introduction/welcome
- llms.txt: https://api.fanvue.com/docs/llms.txt
- OpenAPI JSON: https://api.fanvue.com/openapi.json (auth required)
- Media Upload Tutorial: https://api.fanvue.com/docs/tutorials/multipart-media-upload
- Webhooks: https://api.fanvue.com/docs/webhooks/webhooks/webhooks-overview
- MCP Integration: https://api.fanvue.com/docs/integrations/mcp-ai-assistants
- API Policy: https://legal.fanvue.com/api-policy
- FanvueModels CRM: https://fanvuemodels.com/crm
- Fanvue API Keys: https://www.fanvue.com/api-keys
