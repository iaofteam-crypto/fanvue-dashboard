import { describe, it, expect } from 'vitest';
import {
  messageSchema,
  chatRequestSchema,
  syncKeySchema,
  webhookEventSchema,
  chatTemplateSchema,
} from '@/lib/validation';

// ─── messageSchema ──────────────────────────────────────────────────────────

describe('messageSchema', () => {
  it('accepts a valid user message', () => {
    const result = messageSchema.safeParse({ role: 'user', content: 'Hello world' });
    expect(result.success).toBe(true);
  });

  it('accepts a valid assistant message', () => {
    const result = messageSchema.safeParse({ role: 'assistant', content: 'Hi there!' });
    expect(result.success).toBe(true);
  });

  it('accepts a valid system message', () => {
    const result = messageSchema.safeParse({ role: 'system', content: 'You are helpful.' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid role', () => {
    const result = messageSchema.safeParse({ role: 'moderator', content: 'test' });
    expect(result.success).toBe(false);
  });

  it('rejects empty content', () => {
    const result = messageSchema.safeParse({ role: 'user', content: '' });
    expect(result.success).toBe(false);
  });

  it('rejects content over 4000 characters', () => {
    const result = messageSchema.safeParse({ role: 'user', content: 'A'.repeat(4001) });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const result = messageSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── chatRequestSchema ──────────────────────────────────────────────────────

describe('chatRequestSchema', () => {
  it('accepts valid chat request with messages', () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'Hello' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe('ops'); // default value
    }
  });

  it('accepts valid chat request with explicit mode', () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'Hello' }],
      mode: 'creative',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe('creative');
    }
  });

  it('rejects empty messages array', () => {
    const result = chatRequestSchema.safeParse({ messages: [] });
    expect(result.success).toBe(false);
  });

  it('rejects more than 50 messages', () => {
    const messages = Array.from({ length: 51 }, () => ({
      role: 'user' as const,
      content: 'test',
    }));
    const result = chatRequestSchema.safeParse({ messages });
    expect(result.success).toBe(false);
  });

  it('rejects invalid mode', () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'Hello' }],
      mode: 'invalid_mode',
    });
    expect(result.success).toBe(false);
  });
});

// ─── syncKeySchema ──────────────────────────────────────────────────────────

describe('syncKeySchema', () => {
  it('accepts simple alphanumeric key', () => {
    expect(syncKeySchema.safeParse('earnings').success).toBe(true);
  });

  it('accepts key with hyphens and underscores', () => {
    expect(syncKeySchema.safeParse('my-data_key').success).toBe(true);
  });

  it('rejects empty key', () => {
    expect(syncKeySchema.safeParse('').success).toBe(false);
  });

  it('rejects key starting with non-alphanumeric', () => {
    expect(syncKeySchema.safeParse('_startsWithUnderscore').success).toBe(false);
    expect(syncKeySchema.safeParse('-startsWithHyphen').success).toBe(false);
  });

  it('rejects key with special characters', () => {
    expect(syncKeySchema.safeParse('key with spaces').success).toBe(false);
    expect(syncKeySchema.safeParse('key/with/slashes').success).toBe(false);
    expect(syncKeySchema.safeParse('key.with.dots').success).toBe(false); // dots are not in the regex charset
  });
});

// ─── webhookEventSchema ─────────────────────────────────────────────────────

describe('webhookEventSchema', () => {
  it('accepts a valid message-received event', () => {
    const result = webhookEventSchema.safeParse({
      type: 'message-received',
      messageUuid: 'uuid-123',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid new-follower event', () => {
    const result = webhookEventSchema.safeParse({
      type: 'new-follower',
      follower: { id: 'fan-1', name: 'John' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid tip-received event', () => {
    const result = webhookEventSchema.safeParse({
      type: 'tip-received',
      tip: { amount: 5.0, currency: 'USD' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown event type', () => {
    const result = webhookEventSchema.safeParse({
      type: 'unknown-event',
    });
    expect(result.success).toBe(false);
  });

  it('rejects message-received without messageUuid', () => {
    const result = webhookEventSchema.safeParse({
      type: 'message-received',
    });
    expect(result.success).toBe(false);
  });

  it('rejects new-follower without follower object', () => {
    const result = webhookEventSchema.safeParse({
      type: 'new-follower',
    });
    expect(result.success).toBe(false);
  });
});

// ─── chatTemplateSchema ─────────────────────────────────────────────────────

describe('chatTemplateSchema', () => {
  it('accepts minimal valid template', () => {
    const result = chatTemplateSchema.safeParse({
      name: 'Welcome',
      content: 'Hi {{name}}!',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe('custom'); // default
      expect(result.data.variables).toEqual([]); // default
    }
  });

  it('accepts template with variables and category', () => {
    const result = chatTemplateSchema.safeParse({
      name: 'PPV Offer',
      content: 'Hey {{name}}, check this out!',
      category: 'ppv_offer',
      variables: ['{{name}}'],
      ppvPrice: 9.99,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe('ppv_offer');
      expect(result.data.ppvPrice).toBe(9.99);
    }
  });

  it('rejects empty name', () => {
    const result = chatTemplateSchema.safeParse({
      name: '',
      content: 'Hello',
    });
    expect(result.success).toBe(false);
  });

  it('rejects ppvPrice below minimum of $2.00', () => {
    const result = chatTemplateSchema.safeParse({
      name: 'Cheap',
      content: 'Too cheap',
      ppvPrice: 1.99,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid variable format', () => {
    const result = chatTemplateSchema.safeParse({
      name: 'Bad Var',
      content: 'Test',
      variables: ['not-a-variable'],
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid UUID mediaUuids', () => {
    const result = chatTemplateSchema.safeParse({
      name: 'Media Template',
      content: 'Check this',
      mediaUuids: ['550e8400-e29b-41d4-a716-446655440000'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID in mediaUuids', () => {
    const result = chatTemplateSchema.safeParse({
      name: 'Bad Media',
      content: 'Test',
      mediaUuids: ['not-a-uuid'],
    });
    expect(result.success).toBe(false);
  });
});
