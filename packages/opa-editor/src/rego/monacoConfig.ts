/**
 * Monaco configuration for the Rego language.
 * See design spec §6.2.
 */

import type { DomainDescriptor, SchemaField } from '@develapp/opa-domain-contract';

/**
 * Monarch tokenizer for Rego syntax highlighting.
 * This is a compact definition; the full grammar lives in Regal.
 */
export const regoMonarchLanguage = {
  keywords: [
    'package', 'import', 'as', 'if', 'else', 'not', 'with', 'default',
    'false', 'true', 'null', 'some', 'in', 'contains', 'every',
  ],
  operators: [
    '=', ':=', '==', '!=', '<', '>', '<=', '>=', '+', '-', '*', '/', '%',
    '&', '|', '^', 'and', 'or',
  ],
  symbols: /[=><!~?:&|+\-*/%]+/,
  tokenizer: {
    root: [
      // Comments (# ...)
      [/#.*$/, 'comment'],

      // METADATA blocks
      [/#\s+METADATA/, 'keyword'],
      [/#\s+schemas:/, 'keyword'],
      [/#\s+-\s+input:/, 'string'],

      // Keywords
      [
        /[a-zA-Z_]\w*/,
        {
          cases: {
            '@keywords': 'keyword',
            '@default': 'identifier',
          },
        },
      ],

      // Numbers
      [/\d+(\.\d+)?/, 'number'],

      // Strings
      [/"/, { token: 'string.quote', next: '@string' }],
      [/`/, { token: 'string.quote', next: '@rawstring' }],

      // Operators
      [/@symbols/, {
        cases: {
          '@operators': 'operator',
          '@default': '',
        },
      }],

      // Brackets
      [/[{}()\[\]]/, '@brackets'],

      // Punctuation
      [/[.,;:]/, 'delimiter'],
    ],
    string: [
      [/[^"\\]+/, 'string'],
      [/\\"/, 'string.escape'],
      [/"/, { token: 'string.quote', next: '@pop' }],
    ],
    rawstring: [
      [/[^`]+/, 'string'],
      [/`/, { token: 'string.quote', next: '@pop' }],
    ],
  },
};

/**
 * Generate Monaco completion items from a DomainDescriptor's schema fields.
 * See design spec §6.2 — schema-driven completion.
 */
export function schemaCompletions(
  fields: SchemaField[],
  monaco: any,
): any[] {
  return fields.map((f) => ({
    label: f.path,
    kind: monaco.languages.CompletionItemKind.Field,
    insertText: f.path,
    detail: f.type,
    documentation: f.description ?? `${f.path} (${f.type})`,
  }));
}

/**
 * Generate Monaco snippet completions from a DomainDescriptor's snippets.
 */
export function snippetCompletions(
  snippets: DomainDescriptor['snippets'],
  monaco: any,
): any[] {
  return snippets.map((s) => ({
    label: s.label,
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: s.body,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    detail: s.description,
  }));
}
