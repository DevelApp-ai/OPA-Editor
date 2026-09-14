/**
 * Integration tests for the validator pipeline against real OPA and Regal binaries.
 *
 * These tests are gated by environment variables — they skip if the binaries
 * are not available. In CI, OPA and Regal are installed via the workflow.
 */

import { spawn } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const OPA_BINARY = process.env.OPA_BINARY_PATH ?? 'opa';
const REGAL_BINARY = process.env.REGAL_BINARY_PATH ?? 'regal';

function binaryAvailable(bin: string): boolean {
  try {
    const result = require('child_process').spawnSync(bin, ['version'], {
      stdio: 'pipe',
      timeout: 5000,
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

const OPA_AVAILABLE = binaryAvailable(OPA_BINARY);
const REGAL_AVAILABLE = binaryAvailable(REGAL_BINARY);

const skipIfNoOPA = OPA_AVAILABLE ? describe : describe.skip;
const skipIfNoRegal = REGAL_AVAILABLE ? describe : describe.skip;

const validRego = [
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

const testDescriptor = {
  id: 'test.domain',
  title: 'Test Domain',
  inputSchemaUri: 'schemas/test.json',
  requiredPackagePrefix: 'test.domain',
  requiredRules: ['allow'],
  allowedDataRefs: /^data\.test\./,
  snippets: [],
  validateDomain(rego: string) {
    const { validateDomain } = require('@develapp/opa-domain-contract');
    return validateDomain(rego, this);
  },
};

skipIfNoRegal('Regal integration', () => {
  let RegalBridge: any;

  beforeAll(async () => {
    RegalBridge = (require('../service/regalBridge')).RegalBridge;
  });

  it('lints a valid Rego file with zero violations', async () => {
    const bridge = new RegalBridge({ binaryPath: REGAL_BINARY });
    const tmpDir = mkdtempSync(join(tmpdir(), 'regal-int-'));
    const tmpFile = join(tmpDir, 'policy.rego');
    writeFileSync(tmpFile, 'package test\n\ndefault allow := true\n', 'utf-8');

    const diagnostics = await bridge.lintFileSync(tmpFile);
    expect(diagnostics.filter((d: any) => d.severity === 'error')).toHaveLength(0);
  });

  it('reports violations for a bad Rego file', async () => {
    const bridge = new RegalBridge({ binaryPath: REGAL_BINARY });
    const tmpDir = mkdtempSync(join(tmpdir(), 'regal-int-'));
    const tmpFile = join(tmpDir, 'policy.rego');
    writeFileSync(tmpFile, 'package test\n\nallow = true\n', 'utf-8');

    const diagnostics = await bridge.lintFileSync(tmpFile);
    expect(diagnostics.length).toBeGreaterThan(0);
  });
});

skipIfNoOPA('OPA integration', () => {
  it('evaluates a Rego policy with opa eval', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'opa-int-'));
    const regoFile = join(tmpDir, 'policy.rego');
    const schemaFile = join(tmpDir, 'schema.json');

    writeFileSync(regoFile, [
      'package test.domain',
      '',
      'default allow := false',
      'allow if { input.name == "ok" }',
      '',
    ].join('\n'), 'utf-8');

    writeFileSync(schemaFile, JSON.stringify({
      type: 'object',
      properties: { name: { type: 'string' } },
    }), 'utf-8');

    const { spawnSync } = require('child_process');
    const result = spawnSync(OPA_BINARY, [
      'eval', '--data', regoFile, '--input', '/dev/stdin',
      '--schema', schemaFile,
      'data.test.domain.allow',
    ], {
      input: JSON.stringify({ name: 'ok' }),
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout.toString());
    expect(output.result[0].expressions[0].value).toBe(true);
  });

  it('detects type errors with opa eval --schema', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'opa-int-'));
    const regoFile = join(tmpDir, 'policy.rego');
    const schemaFile = join(tmpDir, 'schema.json');

    writeFileSync(regoFile, [
      '# METADATA',
      '# schemas:',
      '#   - input: schema["test"]',
      'package test.domain',
      '',
      'default allow := false',
      'allow if { input.nonexistent_field == 42 }',
    ].join('\n'), 'utf-8');

    writeFileSync(schemaFile, JSON.stringify({
      type: 'object',
      properties: { name: { type: 'string' } },
    }), 'utf-8');

    const { spawnSync } = require('child_process');
    const result = spawnSync(OPA_BINARY, [
      'eval', '--data', regoFile, '--schema', schemaFile,
      'data.test.domain.allow',
    ], {
      input: JSON.stringify({ name: 'ok' }),
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });

    // OPA should report a type error
    const stderr = result.stderr.toString();
    expect(stderr.length).toBeGreaterThan(0);
  });
});
