import { validateDomain } from '../validateDomain';
import type { DomainDescriptor, DomainValidationResult } from '../types';

/** A minimal DomainDescriptor for testing the generic domain guard. */
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

describe('validateDomain', () => {
  it('accepts a valid Rego module', () => {
    const rego = [
      '# METADATA',
      '# schemas:',
      '#   - input: schema["test"]',
      'package test.domain',
      '',
      'default allow := false',
      '',
      'allow if {',
      '  input.name == "ok"',
      '  data.test.config.enabled',
      '}',
    ].join('\n');

    const result = validateDomain(rego, testDescriptor);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
  });

  it('rejects a missing package declaration', () => {
    const rego = 'allow if { input.name == "ok" }';
    const result = validateDomain(rego, testDescriptor);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.message.includes('Missing package')),
    ).toBe(true);
  });

  it('rejects a wrong package prefix', () => {
    const rego = [
      'package wrong.prefix',
      '',
      'allow if { input.name == "ok" }',
    ].join('\n');

    const result = validateDomain(rego, testDescriptor);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) =>
        e.message.includes('does not match required prefix'),
      ),
    ).toBe(true);
  });

  it('rejects a missing required rule', () => {
    const rego = [
      'package test.domain',
      '',
      'deny if { input.name == "bad" }',
    ].join('\n');

    const result = validateDomain(rego, testDescriptor);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) =>
        e.message.includes("Missing required rule 'allow'"),
      ),
    ).toBe(true);
  });

  it('rejects disallowed data references', () => {
    const rego = [
      'package test.domain',
      '',
      'default allow := false',
      '',
      'allow if {',
      '  data.forbidden.secret == true',
      '}',
    ].join('\n');

    const result = validateDomain(rego, testDescriptor);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) =>
        e.message.includes('Disallowed data references'),
      ),
    ).toBe(true);
  });

  it('issues an info notice when METADATA schema annotation is missing', () => {
    const rego = [
      'package test.domain',
      '',
      'default allow := false',
      '',
      'allow if { input.name == "ok" }',
    ].join('\n');

    const result = validateDomain(rego, testDescriptor);
    expect(result.valid).toBe(true);
    expect(
      result.errors.some(
        (e) => e.severity === 'info' && e.message.includes('METADATA'),
      ),
    ).toBe(true);
  });

  it('allows valid data references matching the pattern', () => {
    const rego = [
      '# METADATA',
      '# schemas:',
      '#   - input: schema["test"]',
      'package test.domain',
      '',
      'default allow := false',
      '',
      'allow if {',
      '  data.test.config.enabled == true',
      '}',
    ].join('\n');

    const result = validateDomain(rego, testDescriptor);
    expect(result.valid).toBe(true);
  });
});
