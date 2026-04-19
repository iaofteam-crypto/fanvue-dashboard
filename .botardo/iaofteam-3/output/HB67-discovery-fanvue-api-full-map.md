# HB#67 — Discovery: Fanvue API Complete Map (2026-04-18 22:30 BA)

## Activity: IA5 (Tech Analysis) — Fanvue API Deep Dive

### Major Discovery: Fanvue API has llms.txt + OpenAPI 3.1 Spec

**Source**: https://api.fanvue.com/docs/llms.txt
**OpenAPI**: https://api.fanvue.com/openapi.json (requires auth)

The Fanvue API documentation is structured for LLM consumption via `llms.txt`,
providing a complete endpoint map. The raw OpenAPI 3.1 spec is also available.

---

## Complete API Endpoint Map (70+ endpoints)

### Users
- GET /v1/users/me — Get current user

### Chats (7 endpoints)
- GET /v1/chats — List chats
- GET /v1/chats/unread-count — Unread count
- GET /v1/chats/:id/media — Media from chat
- POST /v1/chats — Create chat
- GET /v1/chats/batch-statuses — Online statuses
- PATCH /v1/chats/:id — Update chat properties

### Chat Messages (7 endpoints)
- GET /v1/chats/:id/messages — List messages
- POST /v1/chats/:id/messages — Send message
- GET /v1/chats/:id/messages/media/:uuids — Resolve media UUIDs
- GET /v1/chat-messages/mass — List mass messages
- POST /v1/chat-messages/mass — Send mass message
- DELETE /v1/chat-messages/mass/:id — Delete mass message
- DELETE /v1/chat-messages/:id — Delete message

### Chat Templates (2 endpoints)
- GET /v1/chat-templates — List templates
- GET /v1/chat-templates/:id — Get template

### Chat Smart Lists (2 endpoints)
- GET /v1/chat-smart-lists — Get smart lists
- GET /v1/chat-smart-lists/:id/members — Get members

### Chat Custom Lists (6 endpoints)
- GET/POST/PATCH/DELETE /v1/chat-custom-lists — CRUD
- POST/DELETE /v1/chat-custom-lists/:id/members — Add/remove members

### Posts (10 endpoints)
- GET /v1/posts — List posts
- GET /v1/posts/:uuid — Get post
- GET /v1/posts/:uuid/tips — Tips
- GET /v1/posts/:uuid/likes — Likes
- GET /v1/posts/:uuid/comments — Comments
- POST /v1/posts — Create post
- PATCH /v1/posts/:uuid — Update post
- DELETE /v1/posts/:uuid — Delete post
- POST /v1/posts/:uuid/comments — Create comment
- POST /v1/posts/:uuid/repost — Repost
- POST /v1/posts/:uuid/pin — Pin post
- DELETE /v1/posts/:uuid/pin — Unpin post

### Creators (2 endpoints)
- GET /v1/creators/followers — List followers
- GET /v1/creators/subscribers — List subscribers

### Insights (6 endpoints)
- GET /v1/insights/earnings — Earnings data
- GET /v1/insights/earnings-summary — Aggregated summary
- GET /v1/insights/spending — Spending reversal data
- GET /v1/insights/top-spenders — Top spending fans
- GET /v1/insights/subscribers — Subscriber count
- GET /v1/insights/fans/bulk — Bulk fan insights
- GET /v1/insights/fans/:id — Individual fan insights

### Media (6 endpoints) — **MULTIPART UPLOAD (3-STEP)**
- GET /v1/media — User's media list
- GET /v1/media/bulk — Bulk media by UUIDs
- GET /v1/media/:uuid — Get media by UUID
- GET /v1/media/:uuid/entitled — Get entitled media
- POST /v1/media/:uuid/grant — Grant consumer access
- **POST /v1/media/upload-session** — Create multipart upload session
- **GET /v1/media/upload-session/:id/part-url** — Get signed URL for part
- **POST /v1/media/upload-session/:id/complete** — Complete upload

### Tracking Links (6 endpoints)
- CRUD /v1/tracking-links — Full management
- GET /v1/tracking-links/:id/users — List users
- GET /v1/tracking-links/users/:id/metadata — Tracking metadata

### Vault (8 endpoints)
- CRUD /v1/vault/folders — Folder management
- GET /v1/vault/folders/:id/media — List media in folder
- POST/DELETE /v1/vault/folders/:id/media — Attach/detach media

### Agencies (30+ endpoints)
- Full proxy of all creator operations on behalf of creators
- Includes separate upload sessions, post management, messaging, etc.

### Webhooks (6 event types)
- message.received
- message.read
- follower.new
- subscriber.new
- purchase.received
- tip.received

### Integrations
- MCP (AI Assistants) — native AI assistant integration
- n8n — workflow automation
- Conversion Tracking

---

## Critical Finding: Media Upload Needs Update

Our current HB#66 implementation sends multipart/form-data directly to the proxy.
The ACTUAL Fanvue API uses a **3-step presigned URL pattern**:

1. **Create Upload Session**: POST /v1/media/upload-session
   → Returns session ID + required part count
2. **Upload Parts**: GET /v1/media/upload-session/:id/part-url?partNumber=N
   → Returns presigned S3/CloudFront URL
   → PUT file chunk directly to presigned URL (bypasses our proxy)
3. **Complete Session**: POST /v1/media/upload-session/:id/complete
   → Returns media UUID with status "FINALISED"

**Impact**: Our media upload (F2) won't work as-is. Need to rewrite the upload flow
to use the 3-step pattern. The proxy POST handler changes from HB#66 are still
useful (multipart detection), but the actual upload goes directly to S3.

---

## Additional Discoveries

### Vercel Fluid Compute (Hobby Plan)
- Automatic cold start optimizations via bytecode optimization
- Function pre-warming available
- Could reduce our cold start latency significantly
- Edge runtime has 25-second timeout (vs Node.js 10-second default)

### Next.js 16 Features We Should Leverage
- Cache Components (stable)
- Turbopack (stable) — 400% faster dev server
- React Compiler support
- File system caching
- Smart routing improvements

---

## Recommended Next Steps (if CEO approves)

1. **Fix media upload** — Rewrite to 3-step presigned URL pattern
2. **Webhooks** — Add real-time event handling (new messages, subscribers, tips)
3. **Mass messages** — Send broadcast messages to fans
4. **Post features** — Edit posts, pin/unpin, repost, comments
5. **Smart lists** — Auto-segment fans by engagement/spending
6. **Tracking links** — Conversion tracking for marketing
7. **Vault** — Media organization with folders
8. **Insights API** — Top spenders, fan insights, bulk analytics
9. **Chat templates** — Quick replies for common questions
