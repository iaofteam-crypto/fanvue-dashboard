# HB#70 — IA5: P0 Implementation Spec — Precise Code Changes
**Ciclo**: TICK_WORKER iaofteam-3
**Fecha**: 2026-04-19 00:30 BA
**Actividad**: IA5 — Tech Analysis (codebase audit against Fanvue API requirements)

---

## Executive Summary

Analysis of current codebase vs Fanvue API requirements reveals **4 critical issues** and **2 missing features** that block production functionality. This document provides exact file paths, line numbers, and code changes needed.

---

## Issue 1: Missing `X-Fanvue-API-Version` Header (CRITICAL)

### Impact
Fanvue API requires `X-Fanvue-API-Version: 2025-06-26` on ALL requests. Without it, requests will be rejected with a 400 or 410 error. **This is likely already breaking the app in production.**

### Current State
The header is NOT sent in ANY Fanvue API call across the codebase.

### Fix: Single Constant in `src/lib/fanvue.ts`

**File**: `src/lib/fanvue.ts`
**Line 8**: Add new constant after `FANVUE_API_BASE`

```typescript
// ADD after line 8
const FANVUE_API_VERSION = "2025-06-26";
export { FANVUE_API_BASE, FANVUE_API_VERSION };
```

### Files Requiring Header Addition

#### 1a. `src/app/api/fanvue/[...endpoint]/route.ts`

**GET handler (line 28-31)** — Add header:
```typescript
// CURRENT (line 28-31):
headers: {
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
},

// CHANGE TO:
headers: {
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
  "X-Fanvue-API-Version": FANVUE_API_VERSION,
},
```
Need to add `import { FANVUE_API_VERSION }` to the import on line 2.

**POST handler (line 75-77)** — Add header:
```typescript
// CURRENT (line 75-77):
const headers: Record<string, string> = {
  Authorization: `Bearer ${accessToken}`,
};

// CHANGE TO:
const headers: Record<string, string> = {
  Authorization: `Bearer ${accessToken}`,
  "X-Fanvue-API-Version": FANVUE_API_VERSION,
};
```

**DELETE handler (line 141-143)** — Add header:
```typescript
// CURRENT (line 141-143):
headers: {
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
},

// CHANGE TO:
headers: {
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
  "X-Fanvue-API-Version": FANVUE_API_VERSION,
},
```

#### 1b. `src/app/api/crons/sync-fanvue/route.ts`

**fanvueFetch function (line 8-11)** — Add header:
```typescript
// CURRENT (line 8-11):
headers: {
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
},

// CHANGE TO:
headers: {
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
  "X-Fanvue-API-Version": FANVUE_API_VERSION,
},
```
Need to add `FANVUE_API_VERSION` to the import on line 3.

#### 1c. `src/app/api/sync/route.ts`

**performFanvueSync function (line 28-31)** — Add header:
```typescript
// CURRENT (line 28-31):
headers: {
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
},

// CHANGE TO:
headers: {
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
  "X-Fanvue-API-Version": FANVUE_API_VERSION,
},
```
Need to add `FANVUE_API_VERSION` to the import on line 3.

### Total Changes
- 1 new constant in `fanvue.ts`
- 4 header additions across 3 files
- ~12 lines of code changed

---

## Issue 2: API Base URL May Be Wrong (CRITICAL)

### Impact
`FANVUE_API_BASE` is set to `https://api.fanvue.com/v1` but the OpenAPI 3.1 spec shows the server base as `https://api.fanvue.com` (no `/v1` prefix).

### Current State
**File**: `src/lib/fanvue.ts`, **Line 8**:
```typescript
const FANVUE_API_BASE = "https://api.fanvue.com/v1";
```

### Evidence
- OpenAPI spec `servers` section: `url: https://api.fanvue.com`
- SDK code examples show: `https://api.fanvue.com/media/uploads` (no /v1)
- llms.txt endpoints: `/posts`, `/chats`, `/media` (relative to `https://api.fanvue.com`)
- API policy: examples use `https://api.fanvue.com/` as base

### Fix
**File**: `src/lib/fanvue.ts`, **Line 8**:
```typescript
// CURRENT:
const FANVUE_API_BASE = "https://api.fanvue.com/v1";

// CHANGE TO:
const FANVUE_API_BASE = "https://api.fanvue.com";
```

### Risk Assessment
- If `/v1` prefix worked before, Fanvue may have both paths
- Changing to documented base URL aligns with OpenAPI spec
- This is a 1-line change, easy to verify and rollback
- **Recommend**: Test both URLs; if both work, use the one without /v1 (documented)

### Total Changes
- 1 line in `fanvue.ts`

---

## Issue 3: Media Upload Uses Wrong Pattern (CRITICAL)

### Impact
Current implementation sends files as multipart/form-data to a proxy endpoint, which is NOT how Fanvue accepts media uploads. Fanvue requires a 3-step presigned URL flow via S3.

### Current State
**File**: `src/components/dashboard/content-section.tsx`, **Lines 192-221**:
```typescript
// CURRENT: Sends FormData to /api/fanvue/media/upload (WRONG)
for (let i = 0; i < mediaFiles.length; i++) {
  const formData = new FormData();
  formData.append("file", mediaFiles[i].file);
  formData.append("type", mediaFiles[i].type);
  const uploadRes = await fetch("/api/fanvue/media/upload", { method: "POST", body: formData });
  // ...
}
```

### Required Architecture

#### Backend: New Upload Route
**New file**: `src/app/api/fanvue/upload/route.ts`

This route handles the server-side part of the 3-step flow:

```typescript
// POST /api/fanvue/upload — Step 1: Create upload session
// Input: { name: string, filename: string, mediaType: "image"|"video"|"audio"|"document" }
// Output: { mediaUuid: string, uploadId: string }
// Calls: POST https://api.fanvue.com/media/uploads

// GET /api/fanvue/upload?uploadId=X&partNumber=N — Step 2: Get presigned URL
// Output: { url: string } (presigned S3 URL)
// Calls: GET https://api.fanvue.com/media/uploads/{uploadId}/parts/{partNumber}/url

// PATCH /api/fanvue/upload — Step 3: Complete session
// Input: { uploadId: string, parts: [{ PartNumber: number, ETag: string }] }
// Output: { status: "processing"|"ready"|"error" }
// Calls: PATCH https://api.fanvue.com/media/uploads/{uploadId}
```

#### Client: Chunked Upload Logic
**File**: `src/components/dashboard/content-section.tsx`

Replace the FormData upload loop (lines 192-221) with:

```typescript
// Pseudocode for new upload flow:
async function uploadMedia(file: File, mediaType: string): Promise<string> {
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
  
  // Step 1: Create session
  const session = await fetch("/api/fanvue/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, filename: file.name, mediaType })
  }).then(r => r.json());
  // session = { mediaUuid, uploadId }
  
  // Step 2: Upload chunks
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const parts: { PartNumber: number; ETag: string }[] = [];
  
  // Upload up to 3 chunks in parallel
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    
    // Get presigned URL
    const { url } = await fetch(
      `/api/fanvue/upload?uploadId=${session.uploadId}&partNumber=${i + 1}`
    ).then(r => r.json());
    
    // Upload chunk directly to S3
    const s3Response = await fetch(url, {
      method: "PUT",
      body: chunk,
      headers: { "Content-Type": "application/octet-stream" },
    });
    
    const etag = s3Response.headers.get("ETag");
    if (etag) parts.push({ PartNumber: i + 1, ETag: etag });
    
    // Update progress
    setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
  }
  
  // Step 3: Complete session
  const result = await fetch("/api/fanvue/upload", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId: session.uploadId, parts })
  }).then(r => r.json());
  
  return session.mediaUuid; // Return mediaUuid for post creation
}
```

### Key Implementation Details

1. **Vercel Hobby body limit**: 4.5MB. Since chunks go directly to S3 (not through our server), this is not a problem. The API routes only proxy JSON (session create/complete), not the actual file data.

2. **CORS**: S3 presigned URLs should have CORS configured by Fanvue. The client makes direct PUT requests to S3 — no proxy needed for the actual file upload.

3. **File size limit**: Remove the current `MAX_FILE_SIZE = 10MB` restriction. With chunked upload, files can be much larger. Consider setting a reasonable limit like 500MB.

4. **Parallel uploads**: Upload up to 3 chunks concurrently using `Promise.all` with a concurrency limiter. This significantly improves upload speed for large files.

5. **Progress tracking**: Per-chunk progress instead of per-file. Show `Uploading chunk 3/12...` for better UX.

6. **Error handling**: If a chunk fails, retry it up to 3 times before failing the entire upload.

### Total Changes
- 1 new file: `src/app/api/fanvue/upload/route.ts` (~80 lines)
- Rewrite: `content-section.tsx` upload logic (lines 192-221 → ~60 lines)
- Remove: multipart handling from proxy POST handler (lines 72-87 of `[...endpoint]/route.ts`)
- Estimate: ~140 lines total

---

## Issue 4: Missing PATCH Handler in Proxy (HIGH)

### Impact
The Fanvue proxy only supports GET, POST, DELETE. The media upload complete step requires PATCH. Other API endpoints (update post, update chat) also use PATCH.

### Current State
**File**: `src/app/api/fanvue/[...endpoint]/route.ts`
- Has: GET (line 6), POST (line 47), DELETE (line 114)
- Missing: PATCH

### Fix
Add PATCH handler after DELETE handler:

```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string[] }> }
) {
  const rateLimit = checkRateLimit(request, { maxRequests: 30 });
  if (!rateLimit.allowed) {
    const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many API requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { endpoint } = await params;
    const accessToken = await getValidAccessToken(request);
    const path = endpoint.join("/");
    const url = `${FANVUE_API_BASE}/${path}`;

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Fanvue-API-Version": FANVUE_API_VERSION,
      },
      body: JSON.stringify(await request.json()),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    const status = msg.includes("Not connected") ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? msg : sanitizeErrorMessage(error) },
      { status }
    );
  }
}
```

### Total Changes
- ~35 lines added to `[...endpoint]/route.ts`

---

## Missing Feature 1: Webhook Endpoint (HIGH PRIORITY)

### What's Needed
Fanvue can push real-time events (messages, subscribers, tips) to our server. We need:

1. **New file**: `src/app/api/webhooks/fanvue/route.ts`
   - POST handler that receives webhook events
   - HMAC-SHA256 signature verification using `X-Fanvue-Signature` header
   - Event routing: store in DB for real-time UI updates
   - New env var: `FANVUE_WEBHOOK_SECRET`

2. **Schema design** for webhook events:
   - `message-received`: { messageUuid, message: { uuid, text, hasMedia, createdAt } }
   - `message-read`: { messageUuid }
   - `new-follower`: { follower: { ... } }
   - `new-subscriber`: { subscriber: { ... } }
   - `tip-received`: { tip: { amount, sender, ... } }

### Implementation
```typescript
// src/app/api/webhooks/fanvue/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const WEBHOOK_SECRET = process.env.FANVUE_WEBHOOK_SECRET;
const TOLERANCE_SECONDS = 300;

function verifySignature(payload: string, signatureHeader: string): boolean {
  if (!WEBHOOK_SECRET) return false;
  
  const parts = signatureHeader.split(",");
  let timestamp: string | undefined;
  let signature: string | undefined;
  
  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value;
    if (key === "v0") signature = value;
  }
  
  if (!timestamp || !signature) return false;
  
  // Check timestamp tolerance
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > TOLERANCE_SECONDS) return false;
  
  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(signedPayload)
    .digest("hex");
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("X-Fanvue-Signature");
  
  if (!signature || !verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  
  const event = JSON.parse(rawBody);
  // Store event, trigger UI updates, etc.
  // ...
  
  return NextResponse.json({ received: true });
}
```

### Total Changes
- 1 new file: ~50 lines
- 1 new env var: `FANVUE_WEBHOOK_SECRET`

---

## Missing Feature 2: Fanvue API Base URL Verification (P0)

### Action Item
Before making code changes, **verify which base URL works**:
1. Test `https://api.fanvue.com/v1/users/me` (current)
2. Test `https://api.fanvue.com/users/me` (documented)
3. Compare responses

If `/v1` returns 404 or redirect, change to documented base immediately.

---

## Change Summary Table

| # | Issue | Severity | Files Changed | Lines Changed | Effort |
|---|-------|----------|---------------|---------------|--------|
| 1 | Missing API version header | CRITICAL | 4 files | ~12 | 5 min |
| 2 | Wrong base URL (/v1 prefix) | CRITICAL | 1 file | 1 | 2 min |
| 3 | Media upload wrong pattern | CRITICAL | 2 files (1 new) | ~140 | 2 hrs |
| 4 | Missing PATCH handler | HIGH | 1 file | ~35 | 10 min |
| 5 | Webhook endpoint | HIGH | 1 new file | ~50 | 30 min |

**Total estimated effort**: ~3 hours for all fixes.

---

## Execution Order Recommendation

1. **Issue 1 + 2** (15 min) — These are 1-line changes that unblock all API calls
2. **Issue 4** (10 min) — Add PATCH handler
3. **Issue 3** (2 hrs) — Rewrite media upload
4. **Missing Feature 1** (30 min) — Webhook endpoint

Issues 1 and 2 should be done FIRST as they affect ALL Fanvue API calls and may be causing silent failures in production.

---

## Verification Checklist

After implementing changes:
- [ ] Test `GET /api/fanvue/users/me` returns user data (not 400/410)
- [ ] Test `POST /api/fanvue/posts` creates a post
- [ ] Test `DELETE /api/fanvue/posts/{uuid}` deletes a post
- [ ] Test `PATCH` via proxy works
- [ ] Test media upload: create session → get presigned URL → upload chunk → complete
- [ ] Test webhook signature verification
- [ ] Run `npm run build` — ensure no TypeScript errors
- [ ] Test on Vercel deployment
