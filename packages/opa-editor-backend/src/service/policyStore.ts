/**
 * GitOps policy store — persists Rego policies as files in a Git repository.
 *
 * Decision (Q2): GitOps persistence. Rego files are written to a configured
 * Git repository path. An OPA bundle server can then serve these files,
 * enabling versioned, atomic activation and rollback.
 *
 * See design spec §7.4 — Bundle server mode + GitOps.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const execAsync = promisify(exec);

export interface GitOpsStoreOptions {
  /** Local path to the Git repository working copy */
  repoPath: string;
  /** Subdirectory within the repo for policy files */
  policiesDir: string;
  /** Git author name for commits */
  authorName?: string;
  /** Git author email for commits */
  authorEmail?: string;
  /** Default branch to commit to */
  branch?: string;
}

export interface StoredPolicy {
  id: string;
  path: string;
  revision: string;
  domainId: string;
  version: string;
  committedAt: string;
}

export class GitOpsPolicyStore {
  private repoPath: string;
  private policiesDir: string;
  private authorName: string;
  private authorEmail: string;
  private branch: string;

  constructor(options: GitOpsStoreOptions) {
    this.repoPath = options.repoPath;
    this.policiesDir = options.policiesDir;
    this.authorName = options.authorName ?? 'OPA Editor Bot';
    this.authorEmail = options.authorEmail ?? 'opa-editor@develapp.ai';
    this.branch = options.branch ?? 'main';
  }

  /**
   * Persist a Rego policy to the Git repository.
   * Writes the file, stages it, and commits.
   */
  async save(
    policyId: string,
    domainId: string,
    rego: string,
    version: string,
  ): Promise<StoredPolicy> {
    const fullPath = join(this.repoPath, this.policiesDir, `${policyId}.rego`);
    const dir = dirname(fullPath);

    // Ensure the directory exists
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Write the Rego file with a metadata header
    const header = [
      `# Policy ID: ${policyId}`,
      `# Domain: ${domainId}`,
      `# Version: ${version}`,
      `# Committed: ${new Date().toISOString()}`,
      `# Source: OPA Editor (Backstage)`,
      '',
    ].join('\n');

    writeFileSync(fullPath, header + rego, 'utf-8');

    // Git operations
    const git = (args: string[]) =>
      execAsync(`git ${args.join(' ')}`, {
        cwd: this.repoPath,
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: this.authorName,
          GIT_AUTHOR_EMAIL: this.authorEmail,
          GIT_COMMITTER_NAME: this.authorName,
          GIT_COMMITTER_EMAIL: this.authorEmail,
        },
      });

    const relPath = join(this.policiesDir, `${policyId}.rego`);

    try {
      await git(['add', relPath]);
      const commitMsg = `chore(policy): update ${policyId} (${domainId} v${version})`;
      const { stdout } = await git([
        'commit',
        '-m',
        `"${commitMsg}"`,
        '--',
        relPath,
      ]);

      // Extract the commit SHA
      const sha = (await git(['rev-parse', 'HEAD'])).stdout.trim();

      return {
        id: policyId,
        path: relPath,
        revision: sha.substring(0, 12),
        domainId,
        version,
        committedAt: new Date().toISOString(),
      };
    } catch (err) {
      // If commit fails (e.g., no changes), still return the file path
      const sha = (await git(['rev-parse', 'HEAD'])).stdout.trim();
      return {
        id: policyId,
        path: relPath,
        revision: sha.substring(0, 12),
        domainId,
        version,
        committedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Read a stored policy from the Git repository.
   */
  async read(policyId: string): Promise<string | null> {
    const { readFileSync } = await import('fs');
    const fullPath = join(this.repoPath, this.policiesDir, `${policyId}.rego`);
    if (!existsSync(fullPath)) {
      return null;
    }
    return readFileSync(fullPath, 'utf-8');
  }

  /**
   * List all stored policies in the repository.
   */
  async list(): Promise<string[]> {
    const { readdirSync } = await import('fs');
    const fullDir = join(this.repoPath, this.policiesDir);
    if (!existsSync(fullDir)) {
      return [];
    }
    return readdirSync(fullDir)
      .filter((f) => f.endsWith('.rego'))
      .map((f) => f.replace('.rego', ''));
  }
}
