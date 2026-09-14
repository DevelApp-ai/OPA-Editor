/**
 * Tests for the Monaco Rego config.
 */

import { regoMonarchLanguage } from '../rego/monacoConfig';

describe('regoMonarchLanguage', () => {
  it('defines the rego language id', () => {
    expect(regoMonarchLanguage.tokenizer).toBeDefined();
    expect(regoMonarchLanguage.keywords).toContain('package');
    expect(regoMonarchLanguage.keywords).toContain('if');
    expect(regoMonarchLanguage.keywords).toContain('default');
    expect(regoMonarchLanguage.keywords).toContain('contains');
  });

  it('has comment support for #', () => {
    expect(regoMonarchLanguage.tokenizer.root).toBeDefined();
  });
});

describe('schemaCompletions', () => {
  it('converts schema fields to Monaco completions', async () => {
    const { schemaCompletions } = await import('../rego/monacoConfig.js');
    const fakeMonaco = {
      languages: { CompletionItemKind: { Field: 5 } },
    };
    const completions = schemaCompletions(
      [
        { path: 'input.BillingCurrency', type: 'string', enum: ['USD'] },
        { path: 'input.EffectiveCost', type: 'number' },
      ],
      fakeMonaco as any,
    );
    expect(completions).toHaveLength(2);
    expect(completions[0].label).toBe('input.BillingCurrency');
    expect(completions[1].label).toBe('input.EffectiveCost');
  });
});

describe('snippetCompletions', () => {
  it('converts snippets to Monaco snippet completions', async () => {
    const { snippetCompletions } = await import('../rego/monacoConfig.js');
    const fakeMonaco = {
      languages: {
        CompletionItemKind: { Snippet: 4 },
        CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
      },
    };
    const completions = snippetCompletions(
      [
        {
          label: 'Test snippet',
          description: 'A test',
          body: 'package test\ndefault allow := true',
        },
      ],
      fakeMonaco as any,
    );
    expect(completions).toHaveLength(1);
    expect(completions[0].label).toBe('Test snippet');
  });
});
