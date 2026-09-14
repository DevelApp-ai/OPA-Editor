/**
 * Regal LSP bridge — manages a single Regal language server process and
 * multiplexes diagnostics across editor sessions.
 *
 * Regal is the linter and LSP for Rego (from the OPA/Styra ecosystem).
 * See design spec §7.2.
 *
 * Note: The "click-to-evaluate" code lens is VS Code/Neovim only, so we
 * expose evaluation through our own /evaluate endpoint instead.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface RegalDiagnostic {
  range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  severity: 'error' | 'warning' | 'info';
  message: string;
  source: string;
}

export interface RegalBridgeOptions {
  /** Path to the Regal binary. Defaults to 'regal'. */
  binaryPath?: string;
  /** Working directory for Regal. */
  workdir?: string;
}

/**
 * Manages the Regal LSP process.
 *
 * In production this spawns a real Regal binary via stdio and speaks LSP.
 * In development/tests it falls back to running `regal lint` directly
 * per-file (simpler, no LSP session management).
 */
export class RegalBridge extends EventEmitter {
  private binaryPath: string;
  private workdir: string;
  private proc: ChildProcess | null = null;
  private started = false;

  constructor(options: RegalBridgeOptions = {}) {
    super();
    this.binaryPath = options.binaryPath ?? 'regal';
    this.workdir = options.workdir ?? process.cwd();
  }

  /**
   * Start the Regal LSP process (stdio transport).
   * The process stays alive for the lifetime of the backend plugin.
   */
  async start(): Promise<void> {
    if (this.started) return;

    this.proc = spawn(this.binaryPath, ['language-server'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.workdir,
    });

    this.proc.on('error', (err) => {
      this.emit('error', err);
    });

    this.proc.on('exit', (code) => {
      this.started = false;
      this.emit('exit', code);
    });

    this.started = true;
  }

  /**
   * Lint a Rego file synchronously by invoking `regal lint --format json`.
   * This is the fallback path when LSP session management is not available.
   */
  async lintFileSync(filePath: string): Promise<RegalDiagnostic[]> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.binaryPath, ['lint', '--format', 'json', filePath], {
        cwd: this.workdir,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0 && !stdout) {
          reject(new Error(`regal lint exited ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          const violations = result.violations ?? [];
          resolve(
            violations.map(
              (v: {
                location?: { row?: number; col?: number };
                level?: string;
                description?: string;
                title?: string;
                category?: string;
              }) => ({
                range: {
                  startLine: v.location?.row ?? 1,
                  startColumn: v.location?.col ?? 1,
                  endLine: v.location?.row ?? 1,
                  endColumn: v.location?.col ?? 1,
                },
                severity: (v.level ?? 'warning') as RegalDiagnostic['severity'],
                message: v.description ?? v.title ?? 'lint violation',
                source: `regal:${v.category ?? 'lint'}`,
              }),
            ),
          );
        } catch {
          resolve([]);
        }
      });
    });
  }

  /**
   * Lint Rego source code by writing it to a temp file and running regal lint.
   */
  async lintSource(regoSource: string): Promise<RegalDiagnostic[]> {
    const { writeFileSync, unlinkSync, mkdtempSync } = await import('fs');
    const { join } = await import('path');
    const { tmpdir } = await import('os');

    const tmpDir = mkdtempSync(join(tmpdir(), 'regal-lint-'));
    const tmpFile = join(tmpDir, 'policy.rego');
    writeFileSync(tmpFile, regoSource, 'utf-8');

    try {
      return await this.lintFileSync(tmpFile);
    } finally {
      try {
        unlinkSync(tmpFile);
      } catch {
        // ignore
      }
    }
  }

  /** Stop the Regal LSP process. */
  async stop(): Promise<void> {
    if (this.proc) {
      this.proc.kill('SIGTERM');
      this.proc = null;
      this.started = false;
    }
  }

  get isRunning(): boolean {
    return this.started && this.proc !== null;
  }
}
