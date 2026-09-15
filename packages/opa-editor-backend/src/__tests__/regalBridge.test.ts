/**
 * Unit tests for RegalBridge.
 * Mocks child_process spawn.
 */

import { spawn } from 'child_process';

jest.mock('child_process');

describe('RegalBridge', () => {
  let RegalBridge: any;

  beforeEach(async () => {
    RegalBridge = (await import('../service/regalBridge.js')).RegalBridge;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('constructs with default options', () => {
    const bridge = new RegalBridge();
    expect((bridge as any).binaryPath).toBe('regal');
    expect((bridge as any).workdir).toBe(process.cwd());
  });

  it('constructs with custom options', () => {
    const bridge = new RegalBridge({
      binaryPath: '/custom/regal',
      workdir: '/tmp',
    });
    expect((bridge as any).binaryPath).toBe('/custom/regal');
    expect((bridge as any).workdir).toBe('/tmp');
  });

  it('isRunning returns false before start', () => {
    const bridge = new RegalBridge();
    expect(bridge.isRunning).toBe(false);
  });

  it('start spawns the regal language-server process', async () => {
    const mockProc: any = {
      on: jest.fn(),
      kill: jest.fn(),
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      stdin: { on: jest.fn(), write: jest.fn(), end: jest.fn() },
    };
    (spawn as jest.Mock).mockReturnValue(mockProc);

    const bridge = new RegalBridge({ binaryPath: 'regal' });
    await bridge.start();

    expect(spawn).toHaveBeenCalledWith(
      'regal',
      ['language-server'],
      expect.any(Object),
    );
    expect(bridge.isRunning).toBe(true);
  });

  it('stop kills the process', async () => {
    const mockProc: any = {
      on: jest.fn(),
      kill: jest.fn(),
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      stdin: { on: jest.fn(), write: jest.fn(), end: jest.fn() },
    };
    (spawn as jest.Mock).mockReturnValue(mockProc);

    const bridge = new RegalBridge();
    await bridge.start();
    await bridge.stop();

    expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
    expect(bridge.isRunning).toBe(false);
  });

  it('lintFileSync parses Regal JSON output into diagnostics', async () => {
    const mockProc: any = {
      stdout: {
        on: (event: string, cb: (d: Buffer) => void) => {
          if (event === 'data') {
            cb(
              Buffer.from(
                JSON.stringify({
                  violations: [
                    {
                      location: { row: 3, col: 5 },
                      level: 'error',
                      description: 'rule not found',
                      category: 'rules',
                    },
                    {
                      location: { row: 10, col: 1 },
                      level: 'warning',
                      description: 'style issue',
                      category: 'style',
                    },
                  ],
                }),
              ),
            );
          }
        },
      },
      stderr: { on: jest.fn() },
      on: (event: string, cb: (code: number) => void) => {
        if (event === 'close') cb(0);
      },
    };
    (spawn as jest.Mock).mockReturnValue(mockProc);

    const bridge = new RegalBridge();
    const diagnostics = await bridge.lintFileSync('/tmp/policy.rego');

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0].severity).toBe('error');
    expect(diagnostics[0].message).toContain('rule not found');
    expect(diagnostics[0].range.startLine).toBe(3);
    expect(diagnostics[1].severity).toBe('warning');
  });

  it('lintFileSync returns empty array when no violations', async () => {
    const mockProc: any = {
      stdout: {
        on: (event: string, cb: (d: Buffer) => void) => {
          if (event === 'data') {
            cb(Buffer.from(JSON.stringify({ violations: [] })));
          }
        },
      },
      stderr: { on: jest.fn() },
      on: (event: string, cb: (code: number) => void) => {
        if (event === 'close') cb(0);
      },
    };
    (spawn as jest.Mock).mockReturnValue(mockProc);

    const bridge = new RegalBridge();
    const diagnostics = await bridge.lintFileSync('/tmp/policy.rego');
    expect(diagnostics).toEqual([]);
  });

  it('lintFileSync rejects on non-zero exit with no stdout', async () => {
    const mockProc: any = {
      stdout: { on: jest.fn() },
      stderr: {
        on: (event: string, cb: (d: Buffer) => void) => {
          if (event === 'data') cb(Buffer.from('regal error'));
        },
      },
      on: (event: string, cb: (code: number) => void) => {
        if (event === 'close') cb(1);
      },
    };
    (spawn as jest.Mock).mockReturnValue(mockProc);

    const bridge = new RegalBridge();
    await expect(bridge.lintFileSync('/tmp/bad.rego')).rejects.toThrow();
  });
});
