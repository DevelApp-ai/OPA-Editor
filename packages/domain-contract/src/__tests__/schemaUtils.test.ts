/**
 * Unit tests for schemaUtils.
 */

import { extractSchemaFields, parseSchema } from '../schemaUtils';

describe('extractSchemaFields', () => {
  it('extracts top-level string fields', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The name' },
        age: { type: 'number' },
      },
    };
    const fields = extractSchemaFields(schema);
    expect(fields).toHaveLength(2);
    expect(fields[0].path).toBe('input.name');
    expect(fields[0].type).toBe('string');
    expect(fields[0].description).toBe('The name');
    expect(fields[1].path).toBe('input.age');
    expect(fields[1].type).toBe('number');
  });

  it('includes enum values', () => {
    const schema = {
      properties: {
        status: { type: 'string', enum: ['active', 'inactive'] },
      },
    };
    const fields = extractSchemaFields(schema);
    expect(fields[0].enum).toEqual(['active', 'inactive']);
  });

  it('recurses into nested objects', () => {
    const schema = {
      properties: {
        metadata: {
          type: 'object',
          properties: {
            owner: { type: 'string' },
            team: { type: 'string' },
          },
        },
      },
    };
    const fields = extractSchemaFields(schema);
    expect(fields).toHaveLength(3);
    const paths = fields.map((f) => f.path);
    expect(paths).toContain('input.metadata');
    expect(paths).toContain('input.metadata.owner');
    expect(paths).toContain('input.metadata.team');
  });

  it('uses custom prefix', () => {
    const schema = {
      properties: {
        x: { type: 'string' },
      },
    };
    const fields = extractSchemaFields(schema, 'data.custom');
    expect(fields[0].path).toBe('data.custom.x');
  });

  it('returns empty for schema with no properties', () => {
    expect(extractSchemaFields({})).toEqual([]);
    expect(extractSchemaFields({ type: 'object' })).toEqual([]);
  });
});

describe('parseSchema', () => {
  it('parses valid JSON', () => {
    const result = parseSchema('{"type":"object"}');
    expect(result).toEqual({ type: 'object' });
  });

  it('throws on invalid JSON', () => {
    expect(() => parseSchema('not json')).toThrow();
  });

  it('handles complex schema', () => {
    const json = JSON.stringify({
      type: 'object',
      properties: {
        a: { type: 'string' },
      },
    });
    const result = parseSchema(json);
    expect(result.properties.a.type).toBe('string');
  });
});

describe('schemaHash', () => {
  it('computes a SHA-256 hash', async () => {
    const { schemaHash } = await import('../schemaUtils');
    const hash = await schemaHash({ type: 'object' });
    expect(hash).toHaveLength(64); // SHA-256 hex
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic for the same input', async () => {
    const { schemaHash } = await import('../schemaUtils');
    const hash1 = await schemaHash({ a: 1, b: 2 });
    const hash2 = await schemaHash({ b: 2, a: 1 }); // different key order
    expect(hash1).toBe(hash2);
  });

  it('differs for different schemas', async () => {
    const { schemaHash } = await import('../schemaUtils');
    const hash1 = await schemaHash({ a: 1 });
    const hash2 = await schemaHash({ a: 2 });
    expect(hash1).not.toBe(hash2);
  });
});
