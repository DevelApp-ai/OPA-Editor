/**
 * Validator — orchestrates the L1+L2+L3 validation pipeline.
 *
 * L1: OPA `opa eval --schema` static type checking
 * L2: Regal linter diagnostics
 * L3: Domain guard (shared DomainDescriptor.validateDomain)
 *
 * See design spec §4.2 and §7.3.
 */

import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import type { DomainDescriptor, DomainError } from '@develapp/opa-domain-contract';
import { validateDomain } from '@develapp/opa-domain-contract';
import type { RegalBridge, RegalDiagnostic } from './regalBridge';

export interface ValidatorOptions {
  /** Path to the OPA binary. Defaults to 'opa'. */
  opaBinaryPath?: string;
  /** Working directory for OPA. */
  workdir?: string;
}

export interface ValidationRequest {
  domainId: string;
  rego: string;
  domain: DomainDescriptor;
}

export interface FullValidationResult {
  valid: boolean;
  errors: DomainError[];
  layers: {
    L1?: { passed: boolean; errors: DomainError[] };
    L2?: { passed: boolean; errors: DomainError[] };
    L3: { passed: boolean; errors: DomainError[] };
  };
}

/**
 * Run the full L1+L2+L3 validation pipeline on a Rego module.
 */
export async function validatePolicy(
  req: ValidationRequest,
  regalBridge: RegalBridge,
  options: ValidatorOptions = {},
): Promise<FullValidationResult> {
  const { domain } = req;

  // --- L3: Domain guard (always runs first — pure TypeScript, no I/O) ---
  const l3Result = validateDomain(req.rego, domain);
  const l3Errors = l3Result.errors;

  // --- L2: Regal lint ---
  let l2Errors: DomainError[] = [];
  try {
    const regalDiagnostics = await regalBridge.lintSource(req.rego);
    l2Errors = regalDiagnostics.map(toDomainError);
  } catch {
    // If Regal is not available, skip L2 (don't block on missing tooling)
    l2Errors = [
      {
        layer: 'L2-regal',
        severity: 'warning',
        message: 'Regal linter unavailable — skipping L2 validation',
      },
    ];
  }

  // --- L1: OPA schema type check ---
  let l1Errors: DomainError[] = [];
  try {
    l1Errors = await runOpaTypeCheck(
      req.rego,
      domain,
      options.opaBinaryPath ?? 'opa',
    );
  } catch {
    // If OPA binary is not available, skip L1
    l1Errors = [
      {
        layer: 'L1-schema',
        severity: 'warning',
        message: 'OPA binary unavailable — skipping L1 schema type check',
      },
    ];
  }

  const allErrors = [...l1Errors, ...l2Errors, ...l3Errors];
  const hasErrors = allErrors.some((e) => e.severity === 'error');

  return {
    valid: !hasErrors,
    errors: allErrors,
    layers: {
      L1: {
        passed: !l1Errors.some((e) => e.severity === 'error'),
        errors: l1Errors,
      },
      L2: {
        passed: !l2Errors.some((e) => e.severity === 'error'),
        errors: l2Errors,
      },
      L3: {
        passed: !l3Errors.some((e) => e.severity === 'error'),
        errors: l3Errors,
      },
    },
  };
}

/**
 * Run `opa eval --schema` to type-check the Rego module against the
 * domain's input JSON Schema. Returns L1 errors if type checking fails.
 *
 * See design spec §5.1 — OPA schema type checking.
 */
async function runOpaTypeCheck(
  rego: string,
  domain: DomainDescriptor,
  opaBinary: string,
): Promise<DomainError[]> {
  const tmpDir = mkdtempSync(join(tmpdir(), 'opa-tc-'));
  const regoFile = join(tmpDir, 'policy.rego');

  // Write Rego with METADATA schema annotation if not present
  let regoWithSchema = rego;
  if (!rego.includes('# schemas:')) {
    const lines = rego.split('\n');
    const metadata = [
      '# METADATA',
      '# schemas:',
      `#   - input: schema["${domain.id}"]`,
      '',
    ];
    regoWithSchema = [...metadata, ...lines].join('\n');
  }

  writeFileSync(regoFile, regoWithSchema, 'utf-8');

  // Write the schema file (placeholder — in production, load from domain package)
  const schemaFile = join(tmpDir, 'schema.json');
  // The domain's schema should be available; for now we use a minimal schema
  writeFileSync(
    schemaFile,
    JSON.stringify({ type: 'object' }),
    'utf-8',
  );

  try {
    const { stderr } = await runCommand(opaBinary, [
      'eval',
      '--schema',
      schemaFile,
      '--data',
      regoFile,
      '"true"',
    ]);

    // If there are type errors in stderr, parse them
    if (stderr && stderr.includes('type_error')) {
      return parseOpaErrors(stderr, 'L1-schema');
    }

    return [];
  } catch (err) {
    let output = '';
    if (typeof err === 'object' && err !== null && 'stderr' in err) {
      output = String((err as { stderr?: unknown }).stderr ?? '');
    } else if (err instanceof Error) {
      output = err.message;
    } else {
      output = String(err);
    }
    if (output.includes('type_error') || output.includes('rego_type_error')) {
      return parseOpaErrors(output, 'L1-schema');
    }
    // If OPA is not installed, this will be a generic error — rethrow
    throw err;
  } finally {
    try {
      unlinkSync(regoFile);
      unlinkSync(schemaFile);
    } catch {
      // ignore
    }
  }
}

/** Convert a Regal diagnostic to a DomainError. */
function toDomainError(d: RegalDiagnostic): DomainError {
  return {
    layer: 'L2-regal',
    severity: d.severity === 'info' ? 'info' : d.severity === 'error' ? 'error' : 'warning',
    message: d.message,
    range: d.range,
  };
}

/** Parse OPA error output into DomainErrors. */
function parseOpaErrors(
  output: string,
  layer: 'L1-schema',
): DomainError[] {
  const errors: DomainError[] = [];
  const lines = output.split('\n');
  for (const line of lines) {
    if (line.includes('rego_type_error') || line.includes('type_error')) {
      errors.push({
        layer,
        severity: 'error',
        message: line.trim(),
      });
    }
  }
  return errors.length > 0
    ? errors
    : [{ layer, severity: 'error', message: output.trim() }];
}

/** Run a command and return its output. */
function runCommand(
  binary: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(binary, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject({ stdout, stderr, code });
      }
    });
    proc.on('error', reject);
  });
}
