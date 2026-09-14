import { finopsCostModelDomain } from '../domain-guard';
import { finopsSnippets } from '../snippets';

describe('finopsCostModelDomain', () => {
  beforeAll(() => {
    finopsCostModelDomain.snippets = finopsSnippets;
  });

  describe('validateDomain', () => {
    const validRego = [
      '# METADATA',
      '# schemas:',
      '#   - input: schema["finops-focus"]',
      'package finops.costmodel.expensive',
      '',
      'default allow := true',
      'default deny := false',
      'default report := {}',
      '',
      'deny if {',
      '  input.ServiceName == "AWS EC2"',
      '  input.EffectiveCost > 10000',
      '}',
      '',
      'allow if { not deny }',
      '',
      'report[msg] if {',
      '  input.EffectiveCost > 10000',
      '  msg := sprintf("expensive: %v", [input.EffectiveCost])',
      '}',
    ].join('\n');

    it('accepts a valid FOCUS-aligned Rego module', () => {
      const result = finopsCostModelDomain.validateDomain(validRego);
      expect(result.valid).toBe(true);
      expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
    });

    it('rejects a wrong package prefix', () => {
      const rego = validRego.replace(
        'package finops.costmodel.expensive',
        'package security.access',
      );
      const result = finopsCostModelDomain.validateDomain(rego);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) =>
          e.message.includes('does not match required prefix "finops.costmodel"'),
        ),
      ).toBe(true);
    });

    it('rejects a missing required rule (report)', () => {
      const rego = [
        '# METADATA',
        '# schemas:',
        '#   - input: schema["finops-focus"]',
        'package finops.costmodel.simple',
        '',
        'default allow := true',
        'default deny := false',
        '',
        'allow if { not deny }',
        'deny if { input.EffectiveCost > 1000 }',
      ].join('\n');

      const result = finopsCostModelDomain.validateDomain(rego);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) =>
          e.message.includes("Missing required rule 'report'"),
        ),
      ).toBe(true);
    });

    it('rejects disallowed data references', () => {
      const reggo = validRego.replace(
        'input.EffectiveCost > 10000',
        'data.security.secrets.token != ""',
      );
      const result = finopsCostModelDomain.validateDomain(reggo);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) =>
          e.message.includes('Disallowed data references'),
        ),
      ).toBe(true);
    });

    it('allows data.finops.* references', () => {
      const rego = [
        '# METADATA',
        '# schemas:',
        '#   - input: schema["finops-focus"]',
        'package finops.costmodel.budget',
        '',
        'default allow := true',
        'default deny := false',
        'default report := {}',
        '',
        'deny if {',
        '  input.EffectiveCost > data.finops.budget.limit',
        '}',
        'allow if { not deny }',
        'report[msg] if {',
        '  input.EffectiveCost > data.finops.budget.limit',
        '  msg := "over budget"',
        '}',
      ].join('\n');

      const result = finopsCostModelDomain.validateDomain(rego);
      expect(result.valid).toBe(true);
    });
  });

  describe('inputSchemaFields', () => {
    it('returns FOCUS column fields for completion', () => {
      const fields = finopsCostModelDomain.inputSchemaFields!();
      const paths = fields.map((f) => f.path);
      expect(paths).toContain('input.BillingCurrency');
      expect(paths).toContain('input.EffectiveCost');
      expect(paths).toContain('input.ServiceName');
      expect(paths).toContain('input.ResourceStatus');
      expect(paths).toContain('input.Tags');
    });

    it('includes type and enum info', () => {
      const fields = finopsCostModelDomain.inputSchemaFields!();
      const currency = fields.find((f) => f.path === 'input.BillingCurrency');
      expect(currency?.type).toBe('string');
      expect(currency?.enum).toContain('USD');
      expect(currency?.enum).toContain('DKK');
    });
  });

  describe('snippets', () => {
    it('provides at least 4 snippet templates', () => {
      expect(finopsSnippets.length).toBeGreaterThanOrEqual(4);
      for (const s of finopsSnippets) {
        expect(s.label).toBeTruthy();
        expect(s.description).toBeTruthy();
        expect(s.body).toContain('package finops.costmodel');
      }
    });
  });

  describe('domain metadata', () => {
    it('has the correct domain id and title', () => {
      expect(finopsCostModelDomain.id).toBe('finops.costmodel');
      expect(finopsCostModelDomain.title).toContain('FOCUS');
    });

    it('requires the correct package prefix', () => {
      expect(finopsCostModelDomain.requiredPackagePrefix).toBe('finops.costmodel');
    });

    it('requires allow, deny, and report rules', () => {
      expect(finopsCostModelDomain.requiredRules).toEqual(
        expect.arrayContaining(['allow', 'deny', 'report']),
      );
    });
  });
});
