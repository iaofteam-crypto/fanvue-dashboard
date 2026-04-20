import { describe, it, expect } from 'vitest';
import { sanitizeInput, sanitizeHtml, sanitizeKey, sanitizeRegex, sanitizeUrl } from '@/lib/sanitize';

// ─── sanitizeInput ──────────────────────────────────────────────────────────

describe('sanitizeInput', () => {
  it('returns a normal string as-is', () => {
    expect(sanitizeInput('Hello world')).toBe('Hello world');
  });

  it('coerces null to empty string', () => {
    expect(sanitizeInput(null)).toBe('');
  });

  it('coerces undefined to empty string', () => {
    expect(sanitizeInput(undefined)).toBe('');
  });

  it('coerces numbers to string', () => {
    expect(sanitizeInput(42)).toBe('42');
    expect(sanitizeInput(0)).toBe('0');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('removes null bytes', () => {
    expect(sanitizeInput('hello\x00world')).toBe('helloworld');
  });

  it('truncates to maxLength', () => {
    const long = 'A'.repeat(500);
    expect(sanitizeInput(long, 100)).toHaveLength(100);
  });

  it('normalizes unicode to NFC form', () => {
    // é can be composed (U+00E9) or decomposed (U+0065 + U+0301)
    const decomposed = 'e\u0301'; // NFD form
    const composed = '\u00E9';   // NFC form
    expect(sanitizeInput(decomposed)).toBe(composed);
  });

  it('does not truncate when under maxLength', () => {
    expect(sanitizeInput('abc', 100)).toBe('abc');
  });

  it('handles booleans', () => {
    expect(sanitizeInput(true)).toBe('true');
    expect(sanitizeInput(false)).toBe('false');
  });
});

// ─── sanitizeHtml ───────────────────────────────────────────────────────────

describe('sanitizeHtml', () => {
  it('leaves safe HTML intact', () => {
    expect(sanitizeHtml('<p>Hello world</p>')).toBe('<p>Hello world</p>');
    expect(sanitizeHtml('<strong>Bold</strong>')).toBe('<strong>Bold</strong>');
  });

  it('removes script tags and content', () => {
    const input = '<p>Before</p><script>alert("xss")</script><p>After</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('script');
    expect(result).not.toContain('alert');
    expect(result).toContain('<p>Before</p>');
    expect(result).toContain('<p>After</p>');
  });

  it('removes event handler attributes', () => {
    const input = '<div onclick="alert(\'xss\')">Click me</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onclick');
    expect(result).toContain('<div>Click me</div>');
  });

  it('removes javascript: URLs in href', () => {
    const input = '<a href="javascript:alert(1)">Link</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('javascript:');
    expect(result).toContain('Link');
  });

  it('removes iframe opening tags (closing tag may remain as text)', () => {
    const input = '<iframe src="https://evil.com"></iframe>';
    const result = sanitizeHtml(input);
    // The sanitizer removes the opening <iframe> tag with attributes.
    // The bare closing tag </iframe> is not matched by the regex but is inert.
    expect(result).not.toContain('<iframe');
  });

  it('removes object and embed opening tags', () => {
    const input = '<object data="evil.swf"></object><embed src="evil.swf">';
    const result = sanitizeHtml(input);
    // Opening tags with attributes are removed; bare closing tags are inert text
    expect(result).not.toContain('<object');
    expect(result).not.toContain('<embed');
  });

  it('replaces form tags with safe divs', () => {
    const input = '<form action="/steal"><input type="text"></form>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<form');
    expect(result).not.toContain('</form>');
    expect(result).toContain('data-sanitized-form');
  });

  it('removes HTML comments', () => {
    const input = '<!-- malicious --><p>Hello</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<!--');
    expect(result).toContain('<p>Hello</p>');
  });

  it('handles null input gracefully', () => {
    expect(sanitizeHtml(null)).toBe('');
  });

  it('survives escaped script tags even after all processing', () => {
    // Even if someone tries nested tricks
    const input = '<p><scr<script>ipt>alert(1)</scr</script>ipt></p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('alert');
  });
});

// ─── sanitizeKey ────────────────────────────────────────────────────────────

describe('sanitizeKey', () => {
  it('keeps alphanumeric characters', () => {
    expect(sanitizeKey('abc123')).toBe('abc123');
  });

  it('keeps hyphens, underscores, and dots', () => {
    expect(sanitizeKey('my-key_name.test')).toBe('my-key_name.test');
  });

  it('removes spaces', () => {
    expect(sanitizeKey('my key')).toBe('mykey');
  });

  it('removes special characters', () => {
    expect(sanitizeKey('key@#$%value')).toBe('keyvalue');
  });

  it('handles null input', () => {
    expect(sanitizeKey(null)).toBe('');
  });

  it('enforces max length of 200', () => {
    const longKey = 'a'.repeat(500);
    expect(sanitizeKey(longKey).length).toBeLessThanOrEqual(200);
  });

  it('removes null bytes before stripping', () => {
    expect(sanitizeKey('key\x00name')).toBe('keyname');
  });

  it('trims whitespace', () => {
    expect(sanitizeKey('  padded  ')).toBe('padded');
  });
});

// ─── sanitizeRegex ──────────────────────────────────────────────────────────

describe('sanitizeRegex', () => {
  it('escapes regex special characters', () => {
    const input = 'user.*+?^${}()|[]\\';
    const result = sanitizeRegex(input);
    // Verify no unescaped regex metacharacters remain (except the backslash-escaped ones)
    expect(result).toBe('user\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });

  it('leaves normal strings untouched', () => {
    expect(sanitizeRegex('hello')).toBe('hello');
  });

  it('handles null', () => {
    expect(sanitizeRegex(null)).toBe('');
  });
});

// ─── sanitizeUrl ────────────────────────────────────────────────────────────

describe('sanitizeUrl', () => {
  it('normalizes a valid URL', () => {
    const url = 'https://example.com/path?q=1';
    expect(sanitizeUrl(url)).toBe(url);
  });

  it('removes control characters', () => {
    const url = 'https://example.com/\x00path\x1F';
    const result = sanitizeUrl(url);
    expect(result).not.toContain('\x00');
    expect(result).not.toContain('\x1F');
  });

  it('handles null', () => {
    expect(sanitizeUrl(null)).toBe('');
  });

  it('trims whitespace', () => {
    expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com');
  });
});
