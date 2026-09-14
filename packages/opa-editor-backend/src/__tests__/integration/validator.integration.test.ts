/**
 * Integration tests for the validator pipeline against real OPA and Regal binaries.
 *
 * These tests are gated by environment variables — they skip if the binaries
 * are not available. In CI, OPA and Regal are installed via the workflow.
 */

import { writeFileSync, mkdtempSync, mkdirSync } from 'fs';
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

skipIfNoRegal('Regal integration', () => {
  let RegalBridge: any;

  beforeAll(async () => {
    RegalBridge = (require('../../service/regalBridge')).RegalBridge;
  });

  it('lints a valid Rego file with zero violations', async () => {
    const bridge = new RegalBridge({ binaryPath: REGAL_BINARY });
    const tmpDir = mkdtempSync(join(tmpdir(), 'regal-int-'));
    // Regal's directory-structure rule expects the file path to mirror the
    // package path. Write the fixture under a matching subdirectory and lint
    // the temp directory itself, so the relative path is test/policy.rego.
    mkdirSync(join(tmpDir, 'test'), { recursive: true });
    const tmpFile = join(tmpDir, 'test', 'policy.rego');
    writeFileSync(tmpFile, 'package test\n\ndefault allow := true\n', 'utf-8');

    const diagnostics = await bridge.lintFileSync(tmpDir);
    expect(
      diagnostics.filter((d: any) => d.severity === 'error'),
    ).toHaveLength(0);
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
    const inputFile = join(tmpDir, 'input.json');

    // No METADATA schema annotation here: when --schema is passed, OPA
    // enforces schema annotations, and `schema["test"]` has no matching
    // schema in the set (the bare file's id is not "test"), which is
    // itself a compile error ("undefined schema").
    const rego = [
      'package test.domain',
      '',
      'default allow := false',
      'allow if { input.name == "ok" }',
      '',
    ].join('\n');
    writeFileSync(regoFile, rego, 'utf-8');

    const schema = JSON.stringify({
      type: 'object',
      properties: { name: { type: 'string' } },
    });
    writeFileSync(schemaFile, schema, 'utf-8');

    // Write the input to a temp file — reading from /dev/stdin is unreliable
    // in CI (spawnSync piping).
    writeFileSync(inputFile, JSON.stringify({ name: 'ok' }), 'utf-8');

    const { spawnSync } = require('child_process');
    const args = [
      'eval',
      '--data',
      regoFile,
      '--input',
      inputFile,
      '--schema',
      schemaFile,
      'data.test.domain.allow',
    ];
    const result = spawnSync(OPA_BINARY, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });

    // opa eval reports compile/type errors as JSON on stdout (exit code 2),
    // not on stderr — include both streams when surfacing a failure.
    if (result.status !== 0) {
      throw new Error(
        `opa eval failed (${result.status}): ` +
          `${result.stdout.toString()}${result.stderr.toString()}`,
      );
    }
    const output = JSON.parse(result.stdout.toString());
    expect(output.result[0].expressions[0].value).toBe(true);
  });

  it('detects type errors with opa eval --schema', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'opa-int-'));
    const regoFile = join(tmpDir, 'policy.rego');
    const schemaFile = join(tmpDir, 'schema.json');
    const inputFile = join(tmpDir, 'input.json');

    // No METADATA schema annotation here: a bare schema file passed via
    // --schema types `input` globally, so referencing a field that is not
    // in the schema produces a rego_type_error. (An annotation referencing
    // a schema id not in the set, like schema["test"], would fail
    // compilation with "undefined schema" and mask the type error.)
    const rego = [
      'package test.domain',
      '',
      'default allow := false',
      'allow if { input.nonexistent_field == 42 }',
    ].join('\n');
    writeFileSync(regoFile, rego, 'utf-8');

    const schema = JSON.stringify({
      type: 'object',
      properties: { name: { type: 'string' } },
    });
    writeFileSync(schemaFile, schema, 'utf-8');
    writeFileSync(inputFile, JSON.stringify({ name: 'ok' }), 'utf-8');

    const { spawnSync } = require('child_process');
    const args = [
      'eval',
      '--data',
      regoFile,
      '--input',
      inputFile,
      '--schema',
      schemaFile,
      'data.test.domain.allow',
    ];
    const result = spawnSync(OPA_BINARY, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });

    // OPA exits non-zero on the type error. Note that opa eval prints
    // compile and type errors as JSON on STDOUT, not on stderr, so both
    // streams are checked here.
    expect(result.status).not.toBe(0);
    const output = `${result.stdout.toString()}${result.stderr.toString()}`;
    expect(output).toContain('rego_type_error');
  });
});
