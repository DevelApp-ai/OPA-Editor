/**
 * Unit tests for GitOpsPolicyStore.
 * Creates a temp Git repo for testing.
 */

import { execSync } from 'child_process';
import { mkdtempSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('GitOpsPolicyStore', () => {
  let GitOpsPolicyStore: any;
  let repoPath: string;

  beforeAll(async () => {
    GitOpsPolicyStore =
      (await import('../service/policyStore.js')).GitOpsPolicyStore;
  });

  beforeEach(() => {
    // Create a temp git repo
    repoPath = mkdtempSync(join(tmpdir(), 'opa-gitops-test-'));
    execSync('git init', { cwd: repoPath });
    execSync('git config user.email "test@develapp.ai"', { cwd: repoPath });
    execSync('git config user.name "Test User"', { cwd: repoPath });
    // Make an initial commit so HEAD exists
    execSync('git commit --allow-empty -m "init"', { cwd: repoPath });
  });

  it('constructs with correct options', () => {
    const store = new GitOpsPolicyStore({
      repoPath,
      policiesDir: 'policies',
    });
    expect(store).toBeDefined();
  });

  it('saves a policy file and commits to Git', async () => {
    const store = new GitOpsPolicyStore({
      repoPath,
      policiesDir: 'policies',
      authorName: 'Test Bot',
      authorEmail: 'bot@develapp.ai',
    });

    const rego = 'package test.domain\n\ndefault allow := true\n';
    const result = await store.save('my-policy', 'test.domain', rego, '1.0.0');

    expect(result.id).toBe('my-policy');
    expect(result.domainId).toBe('test.domain');
    expect(result.version).toBe('1.0.0');
    expect(result.revision).toHaveLength(12);

    // Verify file exists
    const filePath = join(repoPath, 'policies', 'my-policy.rego');
    expect(existsSync(filePath)).toBe(true);

    // Verify file content includes the header and Rego
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('Policy ID: my-policy');
    expect(content).toContain('Domain: test.domain');
    expect(content).toContain('package test.domain');
  });

  it('reads a stored policy', async () => {
    const store = new GitOpsPolicyStore({
      repoPath,
      policiesDir: 'policies',
    });

    const rego = 'package test.domain\nallow := true\n';
    await store.save('read-test', 'test.domain', rego, '2.0.0');

    const content = await store.read('read-test');
    expect(content).not.toBeNull();
    expect(content).toContain('package test.domain');
  });

  it('returns null for a non-existent policy', async () => {
    const store = new GitOpsPolicyStore({
      repoPath,
      policiesDir: 'policies',
    });

    const content = await store.read('nonexistent');
    expect(content).toBeNull();
  });

  it('lists stored policies', async () => {
    const store = new GitOpsPolicyStore({
      repoPath,
      policiesDir: 'policies',
    });

    await store.save('policy-a', 'test.domain', 'package a\n', '1.0.0');
    await store.save('policy-b', 'test.domain', 'package b\n', '1.0.0');

    const list = await store.list();
    expect(list).toContain('policy-a');
    expect(list).toContain('policy-b');
    expect(list).toHaveLength(2);
  });

  it('returns empty list when no policies exist', async () => {
    const store = new GitOpsPolicyStore({
      repoPath,
      policiesDir: 'policies',
    });

    const list = await store.list();
    expect(list).toEqual([]);
  });
});
