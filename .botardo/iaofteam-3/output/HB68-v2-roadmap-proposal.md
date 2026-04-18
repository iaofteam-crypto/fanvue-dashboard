# HB#68 — v2 Roadmap Proposal (2026-04-18 23:30 BA)

## Activity: IA1 (Investigate Tools) — Fanvue MCP, Webhooks, Upload Tutorial Deep Dive

### Research Summary
Investigated 3 key Fanvue integrations using web-search + web-reader skills:
1. **MCP (Model Context Protocol)** — official Fanvue MCP server
2. **Webhooks** — 5 real-time event types with signature verification
3. **Multipart Upload** — official tutorial with complete code patterns

---

## 1. Fanvue MCP Server (`fanvue-mcp`)

### What It Is
Official Python package `fanvue-mcp` that exposes ALL Fanvue API endpoints as MCP tools for AI assistants (Claude, Cursor, etc.).

### Installation
```bash
pip install fanvue-mcp
# or
uvx fanvue-mcp
```

### Configuration (Claude Desktop)
```json
{
  "mcpServers": {
    "fanvue": {
      "command": "uvx",
      "args": ["fanvue-mcp"],
      "env": {
        "FANVUE_CLIENT_ID": "xxx",
        "FANVUE_CLIENT_SECRET": "xxx"
      }
    }
  }
}
```

### Available Operations via Natural Language
- "Show me my Fanvue profile information"
- "Send a message to user UUID abc-123"
- "What are my top 10 spenders this month?"
- "Create a new post for subscribers"
- "List my most recent followers"

### Impact for Our Dashboard
- AELIANA could directly use MCP tools instead of hardcoded prompts
- CEO could manage Fanvue via Claude/Cursor with natural language
- Could build a "natural language command center" on top of MCP
- No need to proxy API calls — MCP handles auth natively

---

## 2. Webhooks (5 Event Types)

### Events Supported
| Event | Trigger | Payload |
|-------|---------|---------|
| `message.received` | New message from fan | chat UUID, message content, sender info |
| `message.read` | Fan reads creator message | chat UUID, message UUID |
| `follower.new` | New follower | user UUID, display name |
| `subscriber.new` | New subscriber | user UUID, tier, display name |
| `purchase.received` | PPV/content purchase | post UUID, amount, buyer UUID |
| `tip.received` | Tip received | amount, sender UUID, message |

### Setup
1. Create POST endpoint on our backend
2. Register URL in Fanvue Developer Portal → Webhooks tab
3. Enable individual event types

### Signature Verification
```
Header: X-Fanvue-Signature
Format: t=<timestamp>,v0=<hmac-sha256>
Payload: {timestamp}.{raw_body}
Secret: FANVUE_WEBHOOK_SECRET (from Developer Portal)
```

### Implementation Plan for Our App
```typescript
// POST /api/webhooks/fanvue
// 1. Verify X-Fanvue-Signature header
// 2. Parse event type from body
// 3. Update local state (db + real-time UI updates)
// 4. Return 200 immediately
// 5. Process asynchronously (toast notifications, data sync)
```

### Impact for Our Dashboard
- **Real-time notifications** — new messages/subscribers/tips without polling
- **Live dashboard updates** — earnings, follower counts update automatically
- **Toast alerts** — "New subscriber: John!" / "Tip received: $5 from Sarah!"
- **Event log** — persistent feed of all account activity
- **No more manual sync** — webhooks push data to us

---

## 3. Multipart Upload — Official Implementation Pattern

### 3-Phase Flow (CONFIRMED from tutorial)

**Phase 1: Create Upload Session**
```
POST /v1/media/uploads
→ Returns: mediaUuid + uploadId
```

**Phase 2: Upload Parts (Loop)**
```
For each chunk (10MB each):
  GET /v1/media/uploads/{uploadId}/parts/{partNumber}/url
  → Returns: presigned S3 URL
  PUT <presigned_url> with chunk body
  → Returns: ETag (proof of upload)
```

**Phase 3: Complete Session**
```
PATCH /v1/media/uploads/{uploadId}
Body: { parts: [{ partNumber, etag }] }
→ Returns: Final media UUID, processing started
```

### Key Implementation Details from Tutorial
- **Chunk size**: 10MB recommended
- **Parallel uploads**: Multiple chunks can upload simultaneously
- **Retry logic**: Individual chunk failures don't restart entire upload
- **Progress tracking**: Per-chunk progress for accurate UI feedback
- **MediaItem interface**:
  ```typescript
  interface MediaItem {
    uuid: string;
    status: "created" | "processing" | "ready" | "error";
    variants: Array<{ type: string; url: string; width?: number; height?: number }>;
  }
  ```
- **Variant types**: `thumbnail_gallery` for grid display, `full` for full-size
- **After upload**: Media enters processing pipeline (thumbnail generation)

### What Needs to Change in Our App (HB#66 Fix)
Current implementation sends `multipart/form-data` to proxy — **WRONG**.
Need to:
1. Create upload session via `/api/fanvue/media/uploads`
2. Split file into 10MB chunks in browser
3. Request presigned URLs for each part
4. Upload chunks DIRECTLY to S3 (bypass our proxy)
5. Complete session with ETags
6. Reference media UUID when creating post

---

## 4. v2 Roadmap Proposal (Prioritized)

### Phase A: Fix Media Upload (HIGH — fixes HB#66)
- [ ] Rewrite upload flow to 3-phase presigned URL pattern
- [ ] Client-side chunking (10MB chunks)
- [ ] Parallel chunk upload with retry
- [ ] Per-chunk progress bar
- [ ] Media status polling (created → processing → ready)

### Phase B: Webhooks (HIGH — real-time everything)
- [ ] POST /api/webhooks/fanvue endpoint with signature verification
- [ ] Process 5 event types
- [ ] Real-time toast notifications
- [ ] Live counter updates (messages, subscribers, earnings)
- [ ] Event log/activity feed section
- [ ] Environment variable: FANVUE_WEBHOOK_SECRET

### Phase C: MCP Integration (MEDIUM — AI power-up)
- [ ] Install fanvue-mcp, configure AELIANA to use MCP tools
- [ ] Natural language post creation ("create a PPV post for $9.99")
- [ ] Natural language analytics queries
- [ ] CEO natural language control panel

### Phase D: Enhanced Post Management (MEDIUM)
- [ ] Edit post (PATCH /v1/posts/:uuid)
- [ ] Pin/unpin posts
- [ ] Repost content
- [ ] Post comments
- [ ] Draft management

### Phase E: Mass Messaging (LOW)
- [ ] Smart lists integration
- [ ] Custom lists CRUD
- [ ] Mass message composer
- [ ] Scheduled mass messages

### Phase F: Vault & Organization (LOW)
- [ ] Vault folder management
- [ ] Media organization by folder
- [ ] Bulk media operations

### Phase G: Tracking & Insights (LOW)
- [ ] Tracking link creation/management
- [ ] Conversion tracking dashboard
- [ ] Top spenders visualization
- [ ] Fan insights (individual + bulk)
- [ ] Spending reversal tracking

---

## 5. New Environment Variables Needed
```env
FANVUE_WEBHOOK_SECRET=       # For webhook signature verification
FANVUE_CLIENT_ID=            # Already exists
FANVUE_CLIENT_SECRET=        # Already exists
FANVUE_REDIRECT_URI=         # Already exists
```

---

## 6. Research Sources
- Fanvue MCP Docs: `api.fanvue.com/docs/integrations/mcp-ai-assistants.mdx`
- Fanvue Webhooks: `api.fanvue.com/docs/webhooks/webhooks/webhooks-overview.mdx`
- Multipart Upload Tutorial: `api.fanvue.com/docs/tutorials/multipart-media-upload.mdx`
- API Full Map: `api.fanvue.com/docs/llms.txt`
- MCP Protocol Research: web search results
- Webhook Patterns: web search results
