// Simple KV store — works on Vercel serverless (no SQLite dependency)
// In-memory with optional @vercel/kv persistence
//
// NOTE: On Vercel, cold starts will lose in-memory data.
// To persist tokens across cold starts, add @vercel/kv and set KV_REST_API_URL + KV_REST_API_TOKEN env vars.
// Tokens will then be stored in Vercel KV (Redis).

interface OAuthTokenRecord {
  id: string;
  provider: string;
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  expiresAt: string; // ISO date
  scope: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SyncLogRecord {
  id: string;
  type: string;
  status: string;
  message: string | null;
  startedAt: string;
  finishedAt: string | null;
}

interface DiscoveryRecord {
  id: string;
  refId: string;
  title: string;
  category: string;
  tags: string | null;
  summary: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// ─── In-Memory Store ────────────────────────────────────────────────

const store = {
  tokens: new Map<string, OAuthTokenRecord>(),
  syncLogs: new Map<string, SyncLogRecord>(),
  discoveries: new Map<string, DiscoveryRecord>(),
};

// ─── KV Helper (Vercel KV) ──────────────────────────────────────────

async function kvGet(key: string): Promise<string | null> {
  if (!process.env.KV_REST_API_URL) return null;
  try {
    const { kv } = await import("@vercel/kv");
    return (await kv.get(key)) as string | null;
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: string, ex?: number): Promise<void> {
  if (!process.env.KV_REST_API_URL) return;
  try {
    const { kv } = await import("@vercel/kv");
    if (ex) {
      await kv.set(key, value, { ex });
    } else {
      await kv.set(key, value);
    }
  } catch {
    // ignore
  }
}

async function kvDel(key: string): Promise<void> {
  if (!process.env.KV_REST_API_URL) return;
  try {
    const { kv } = await import("@vercel/kv");
    await kv.del(key);
  } catch {
    // ignore
  }
}

// ─── Public API ─────────────────────────────────────────────────────

export const db = {
  oAuthToken: {
    async findUnique(args: { where: { id: string } }): Promise<OAuthTokenRecord | null> {
      const { id } = args.where;
      // Try KV first
      const kvVal = await kvGet(`token:${id}`);
      if (kvVal) {
        return JSON.parse(kvVal);
      }
      return store.tokens.get(id) || null;
    },

    async upsert({
      where,
      update,
      create,
    }: {
      where: { id: string };
      update: Partial<OAuthTokenRecord>;
      create: Partial<OAuthTokenRecord> & { id: string; provider: string; accessToken: string };
    }): Promise<OAuthTokenRecord> {
      const existing = store.tokens.get(where.id);
      const now = new Date().toISOString();
      const record: OAuthTokenRecord = existing
        ? { ...existing, ...update, updatedAt: now }
        : {
            id: create.id,
            provider: create.provider,
            accessToken: create.accessToken,
            refreshToken: create.refreshToken ?? null,
            expiresIn: create.expiresIn ?? 0,
            expiresAt: create.expiresAt ?? now,
            scope: create.scope ?? null,
            createdAt: now,
            updatedAt: now,
          };

      store.tokens.set(where.id, record);
      await kvSet(`token:${where.id}`, JSON.stringify(record), 86400); // 24h TTL
      return record;
    },

    async update(args: { where: { id: string }; data: Partial<OAuthTokenRecord> }): Promise<OAuthTokenRecord> {
      const { id } = args.where;
      const existing = store.tokens.get(id);
      if (!existing) throw new Error(`Token ${id} not found`);

      const now = new Date().toISOString();
      const record = { ...existing, ...args.data, updatedAt: now };

      store.tokens.set(id, record);
      await kvSet(`token:${id}`, JSON.stringify(record), 86400);
      return record;
    },

    async delete(args: { where: { id: string } }): Promise<void> {
      const { id } = args.where;
      store.tokens.delete(id);
      await kvDel(`token:${id}`);
    },
  },

  syncLog: {
    async create(data: Partial<Omit<SyncLogRecord, "id">> & { id?: string }): Promise<SyncLogRecord> {
      const id = data.id || crypto.randomUUID();
      const now = new Date().toISOString();
      const record: SyncLogRecord = {
        id,
        type: data.type || "unknown",
        status: data.status || "running",
        message: data.message ?? null,
        startedAt: data.startedAt || now,
        finishedAt: data.finishedAt ?? null,
      };
      store.syncLogs.set(id, record);
      return record;
    },

    async update(args: { where: { id: string }; data: Partial<SyncLogRecord> }): Promise<SyncLogRecord> {
      const { id } = args.where;
      const existing = store.syncLogs.get(id);
      if (!existing) throw new Error(`SyncLog ${id} not found`);
      const record = { ...existing, ...args.data };
      store.syncLogs.set(id, record);
      return record;
    },

    async findMany(args: { orderBy?: { startedAt: "desc" }; take?: number }): Promise<SyncLogRecord[]> {
      let logs = Array.from(store.syncLogs.values());
      if (args?.orderBy?.startedAt === "desc") {
        logs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      }
      if (args?.take) {
        logs = logs.slice(0, args.take);
      }
      return logs;
    },
  },

  discovery: {
    async upsert({
      where,
      update,
      create,
    }: {
      where: { id: string };
      update: Partial<DiscoveryRecord>;
      create: Partial<DiscoveryRecord> & { id: string; refId: string; title: string };
    }): Promise<DiscoveryRecord> {
      const existing = store.discoveries.get(where.id);
      const now = new Date().toISOString();
      const record: DiscoveryRecord = existing
        ? { ...existing, ...update, updatedAt: now }
        : {
            id: create.id,
            refId: create.refId,
            title: create.title,
            category: create.category || "general",
            tags: create.tags ?? null,
            summary: create.summary ?? null,
            status: create.status || "new",
            createdAt: now,
            updatedAt: now,
          };

      store.discoveries.set(where.id, record);
      return record;
    },
  },
};
