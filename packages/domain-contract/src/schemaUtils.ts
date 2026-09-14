/**
 * Utilities for working with JSON Schemas in the domain-scoped editor.
 *
 * See design spec §5.1, §6.2, §9.
 */

import type { SchemaField } from './types';

/**
 * Compute a stable SHA-256 hash of a JSON Schema.
 *
 * Used for drift detection: the `DomainDescriptor` exposes this hash, and the
 * `/validate` response echoes it so the frontend can detect if its bundled
 * schema differs from the backend's. See design spec §9.
 */
export async function schemaHash(schema: object): Promise<string> {
  const text = JSON.stringify(sortKeys(schema));
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Recursively sort object keys for stable hashing.
 */
function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Extract top-level fields from a JSON Schema for editor completion.
 *
 * Given an input schema like `{ "properties": { "BillingCurrency": { "type": "string" } } }`,
 * returns `[{ path: "input.BillingCurrency", type: "string" }]`.
 *
 * See design spec §6.2 — schema-driven completion.
 */
export function extractSchemaFields(
  schema: object,
  prefix = 'input',
): SchemaField[] {
  const fields: SchemaField[] = [];
  const root = schema as { properties?: Record<string, unknown> };

  if (!root.properties) {
    return fields;
  }

  for (const [name, def] of Object.entries(root.properties)) {
    const path = `${prefix}.${name}`;
    const propDef = def as {
      type?: string;
      description?: string;
      enum?: string[];
      properties?: Record<string, unknown>;
      items?: unknown;
    };

    fields.push({
      path,
      type: propDef.type ?? 'unknown',
      description: propDef.description,
      enum: propDef.enum,
    });

    // Recurse into nested objects
    if (propDef.type === 'object' && propDef.properties) {
      fields.push(...extractSchemaFields(propDef as object, path));
    }
  }

  return fields;
}

/**
 * Load a JSON Schema from a URI (file path or URL).
 * In the browser this would be a fetch; in Node it's a file read.
 * The actual loading is deferred to the consuming package so this function
 * is environment-agnostic.
 */
export function parseSchema(jsonText: string): object {
  return JSON.parse(jsonText);
}
