/**
 * Unit tests for the validator pipeline.
 * Mocks OPA binary and Regal bridge; tests L3 logic and fallback behavior.
 */

import type { DomainDescriptor, DomainValidationResult } from '@develapp/opa-domain-contract';
import { validateDomain } from '@develapp/opa-domain-contract';

const testDescriptor: DomainDescriptor = {
  id: 'test.domain',
  title: 'Test Domain',
  inputSchemaUri: 'schemas/test.json',
  requiredPackagePrefix: 'test.domain',
  requiredRules: ['allow'],
  allowedDataRefs: /^data\.test\./,
  snippets: [],
  validateDomain(rego: string): DomainValidationResult {
    return validateDomain(rego, this);
  },
};

const validRego = [
  '# METADATA',
  '# schemas:',
  '#   - input: schema["test"]',
  'package test.domain',
  '',
  'default allow := false',
  'allow if { input.name == "ok" }',
].join('\n');

describe('validatePolicy', () => {
  let mockRegalBridge: any;

  beforeEach(() => {
    mockRegalBridge = {
      lintSource: jest.fn().mockResolvedValue([]),
    };
  });

  it('runs L3 domain guard and returns valid for a correct policy', async () => {
    const { validatePolicy } = await import('../service/validator.js');
    const result = await validatePolicy(
      { domainId: 'test.domain', rego: validRego, domain: testDescriptor },
      mockRegalBridge,
      { opaBinaryPath: '/nonexistent/opa' },
    );

    expect(result.layers.L3.passed).toBe(true);
    expect(result.valid).toBe(true);
  });

  it('includes L2 warnings when Regal is unavailable', async () => {
    mockRegalBridge.lintSource = jest.fn().mockRejectedValue(new Error('regal not found'));
    const { validatePolicy } = await import('../service/validator.js');
    const result = await validatePolicy(
      { domainId: 'test.domain', rego: validRego, domain: testDescriptor },
      mockRegalBridge,
      { opaBinaryPath: '/nonexistent/opa' },
    );

    const l2Warnings = result.layers.L2!.errors.filter(
      (e) => e.severity === 'warning',
    );
    expect(l2Warnings.length).toBeGreaterThan(0);
    expect(l2Warnings[0].message).toContain('Regal');
  });

  it('includes L1 warnings when OPA binary is unavailable', async () => {
    const { validatePolicy } = await import('../service/validator.js');
    const result = await validatePolicy(
      { domainId: 'test.domain', rego: validRego, domain: testDescriptor },
      mockRegalBridge,
      { opaBinaryPath: '/nonexistent/opa' },
    );

    const l1Warnings = result.layers.L1!.errors.filter(
      (e) => e.severity === 'warning',
    );
    expect(l1Warnings.length).toBeGreaterThan(0);
    expect(l1Warnings[0].message).toContain('OPA');
  });

  it('fails when L3 domain guard finds errors', async () => {
    const { validatePolicy } = await import('../service/validator.js');
    const badRego = 'package wrong.prefix\n\ndefault allow := false\nallow if { true }';
    const result = await validatePolicy(
      { domainId: 'test.domain', rego: badRego, domain: testDescriptor },
      mockRegalBridge,
      { opaBinaryPath: '/nonexistent/opa' },
    );

    expect(result.layers.L3.passed).toBe(false);
    expect(result.valid).toBe(false);
    expect(
      result.layers.L3.errors.some((e) =>
        e.message.includes('does not match required prefix'),
      ),
    ).toBe(true);
  });

  it('converts Regal diagnostics to DomainErrors', async () => {
    mockRegalBridge.lintSource = jest.fn().mockResolvedValue([
      {
        range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 },
        severity: 'error',
        message: 'rule named allow not found',
        source: 'regal:rules',
      },
    ]);
    const { validatePolicy } = await import('../service/validator.js');
    const result = await validatePolicy(
      { domainId: 'test.domain', rego: validRego, domain: testDescriptor },
      mockRegalBridge,
      { opaBinaryPath: '/nonexistent/opa' },
    );

    expect(result.layers.L2!.errors.length).toBeGreaterThan(0);
    expect(result.layers.L2!.errors[0].layer).toBe('L2-regal');
    expect(result.layers.L2!.errors[0].message).toContain('allow not found');
  });

  it('aggregates errors from all layers', async () => {
    mockRegalBridge.lintSource = jest.fn().mockResolvedValue([
      {
        range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 },
        severity: 'warning',
        message: 'style issue',
        source: 'regal:style',
      },
    ]);
    const { validatePolicy } = await import('../service/validator.js');
    const result = await validatePolicy(
      { domainId: 'test.domain', rego: validRego, domain: testDescriptor },
      mockRegalBridge,
      { opaBinaryPath: '/nonexistent/opa' },
    );

    expect(result.errors.length).toBeGreaterThan(0);
    const layers = result.errors.map((e) => e.layer);
    expect(layers).toContain('L3-domain');
    expect(layers).toContain('L2-regal');
    expect(layers).toContain('L1-schema');
  });
});
