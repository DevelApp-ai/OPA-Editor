/**
 * End-to-end test: author → validate → publish → verify in OPA.
 *
 * This test starts a real OPA server, creates a backend router with real
 * dependencies, and exercises the full publish flow.
 *
 * Requires:
 * - OPA binary (OPA_BINARY_PATH env var or 'opa' in PATH)
 * - OPA server running (OPA_SERVER_URL env var, or a local one is started)
 */

import { spawn, ChildProcess } from 'child_process';
import { mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const OPA_BINARY = process.env.OPA_BINARY_PATH ?? 'opa';
const OPA_SERVER_URL = process.env.OPA_SERVER_URL ?? '';
// Bind the locally-started OPA server to an explicit IPv4 address —
// 'localhost' can resolve to ::1 first, which the server may not listen on.
const LOCAL_OPA_URL = 'http://127.0.0.1:8181';

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

const e2eDescribe = OPA_AVAILABLE ? describe : describe.skip;

const validRego = [
  '# METADATA',
  '# schemas:',
  '#   - input: schema["test"]',
  'package test.domain.e2e',
  '',
  'default allow := false',
  'default deny := false',
  'default report := {}',
  '',
  'deny if { input.cost > 10000 }',
  'allow if { not deny }',
  'report[msg] if {',
  '  input.cost > 10000',
  '  msg := sprintf("high cost: %v", [input.cost])',
  '}',
].join('\n');

/** Poll the OPA server until it responds on /health, up to timeoutMs. */
async function waitForOpa(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const resp = await fetch(`${url}/health`);
      if (resp.ok) {
        return true;
      }
    } catch {
      // Server not accepting connections yet — keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

e2eDescribe('E2E: author → validate → publish → verify', () => {
  let opaProcess: ChildProcess | null = null;
  let opaUrl: string;
  let OpaClient: any;
  let GitOpsPolicyStore: any;
  let repoPath: string;

  beforeAll(async () => {
    OpaClient = (await import('../../service/opaClient.js')).OpaClient;
    GitOpsPolicyStore = (await import('../../service/policyStore.js'))
      .GitOpsPolicyStore;

    // Start OPA server (unless an external one was configured via env)
    opaUrl = OPA_SERVER_URL || LOCAL_OPA_URL;
    if (!OPA_SERVER_URL) {
      opaProcess = spawn(OPA_BINARY, ['server', '--addr', '127.0.0.1:8181'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
      });

      let opaStderr = '';
      opaProcess.stderr?.on('data', (data) => {
        opaStderr += data.toString();
      });

      // Wait for OPA to be ready instead of sleeping for a fixed time
      const ready = await waitForOpa(opaUrl, 20000);
      if (!ready) {
        throw new Error(
          `OPA server did not become ready at ${opaUrl}. ` +
            `stderr: ${opaStderr.slice(-500)}`,
        );
      }
    }

    // Create temp Git repo for GitOps
    repoPath = mkdtempSync(join(tmpdir(), 'opa-e2e-'));
    require('child_process').execSync('git init', { cwd: repoPath });
    require('child_process').execSync('git config user.email "e2e@test.ai"', { cwd: repoPath });
    require('child_process').execSync('git config user.name "E2E Test"', { cwd: repoPath });
    require('child_process').execSync('git commit --allow-empty -m "init"', { cwd: repoPath });
  }, 30000);

  afterAll(() => {
    if (opaProcess) {
      opaProcess.kill('SIGTERM');
    }
  });

  it('validates a Rego policy through the pipeline', async () => {
    const { validateDomain } = require('@develapp/opa-domain-contract');

    const descriptor = {
      id: 'test.domain',
      title: 'Test Domain',
      inputSchemaUri: 'schemas/test.json',
      requiredPackagePrefix: 'test.domain',
      requiredRules: ['allow', 'deny', 'report'],
      allowedDataRefs: /^data\.test\./,
      snippets: [],
      validateDomain(rego: string) {
        return validateDomain(rego, this);
      },
    };

    const result = descriptor.validateDomain(validRego);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e: any) => e.severity === 'error')).toHaveLength(0);
  });

  it('publishes a policy to OPA via REST', async () => {
    const client = new OpaClient({ baseUrl: opaUrl });
    const result = await client.publishPolicy('e2e-test-policy', validRego);

    expect(result.status).toBe('ok');
    expect(result.id).toBe('e2e-test-policy');
  });

  it('verifies the published policy is active in OPA', async () => {
    // Wait a moment for the policy to be active
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Query the policy to verify it's active
    const resp = await fetch(`${opaUrl}/v1/policies/e2e-test-policy`, {
      headers: { 'Content-Type': 'application/json' },
    });

    expect(resp.ok).toBe(true);
    const policy = await resp.json();
    expect(policy.id).toBe('e2e-test-policy');
    expect(policy.raw).toContain('package test.domain.e2e');
  });

  it('persists the policy to the GitOps store', async () => {
    const store = new GitOpsPolicyStore({
      repoPath,
      policiesDir: 'policies',
    });

    const result = await store.save('e2e-persist', 'test.domain', validRego, '1.0.0');

    expect(result.id).toBe('e2e-persist');
    expect(result.revision).toHaveLength(12);

    // Verify file exists in the repo
    const content = await store.read('e2e-persist');
    expect(content).not.toBeNull();
    expect(content).toContain('package test.domain.e2e');
  });

  it('evaluates the published policy against input', async () => {
    // Use the ad-hoc query API to evaluate the policy
    const resp = await fetch(`${opaUrl}/v1/data/test/domain/e2e/allow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { cost: 5000 } }),
    });

    expect(resp.ok).toBe(true);
    const result = await resp.json();
    // With cost=5000 (< 10000), deny is false, so allow should be true
    expect(result.result).toBe(true);
  });
});
