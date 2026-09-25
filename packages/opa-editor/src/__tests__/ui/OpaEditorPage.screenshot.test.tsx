/**
 * UI screenshot tests for the OPA editor (issue #14).
 *
 * Renders the real component tree in jsdom across the meaningful UI
 * states and writes each render as a standalone HTML file under
 * `__screenshots__/`. The committed files let a reviewer open any
 * state of the UI in a browser without running Backstage, and the
 * `ui-screenshots` CI workflow converts them to PNG images with
 * Playwright and uploads them as build artifacts.
 *
 * Each test also asserts a "usefulness contract" before capturing, so a
 * screenshot can never silently record a broken or empty page.
 */

import {
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { OpaEditorPage } from '../../components/OpaEditorPage';
import { DiagnosticsPanel } from '../../components/DiagnosticsPanel';
import { DomainPicker } from '../../components/DomainPicker';
import type { PublishResponse } from '../../api/OpaEditorApiClient';
import type { DomainError } from '@develapp/opa-domain-contract';
import { renderScreenshot } from './screenshotHarness';

// --- Mocks (same as OpaEditorPage.ui.test.tsx) --------------------------

// Mock Backstage API module entirely (ESM dist + Jest hoisting — see
// OpaEditorPage.ui.test.tsx for the full rationale).
jest.mock('@backstage/core-plugin-api', () => {
  const mockApi = {
    getDomains: jest.fn(),
    validate: jest.fn(),
    evaluate: jest.fn(),
    publish: jest.fn(),
  };
  return {
    createApiRef: (config: { id: string }) => ({ id: config.id }),
    useApi: () => mockApi,
    __mockOpaApi: mockApi,
  };
});

/** Mock Monaco with a plain textarea so jsdom can render the editor. */
jest.mock('@monaco-editor/react', () => ({
  Editor: ({
    value,
    onChange,
  }: {
    value?: string;
    onChange?: (v: string | undefined) => void;
  }) => (
    <textarea
      aria-label="rego-editor"
      style={{ width: '100%', height: '100%' }}
      value={value}
      onChange={(e: { target: { value: string } }) =>
        onChange?.(e.target.value)
      }
    />
  ),
}));

const { validate: validateMock, publish: publishMock } =
  (jest.requireMock('@backstage/core-plugin-api') as {
    __mockOpaApi: Record<string, jest.Mock>;
  }).__mockOpaApi;

const sampleErrors: DomainError[] = [
  {
    layer: 'L1-schema',
    severity: 'error',
    message: 'input.EffectiveCost: undefined field',
    range: { startLine: 17, startColumn: 3, endLine: 17, endColumn: 25 },
  },
  {
    layer: 'L2-regal',
    severity: 'warning',
    message: 'prefer := over = for assignment',
  },
  {
    layer: 'L3-domain',
    severity: 'error',
    message: 'policy references data outside the domain allowlist',
  },
];

// --- Tests -------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe('UI screenshots — OpaEditorPage', () => {
  it('captures the default (fresh policy) state', async () => {
    validateMock.mockResolvedValue({ ok: true, errors: [] });

    const file = await renderScreenshot(<OpaEditorPage />, {
      title: 'opa-editor-page default state',
      name: 'opa-editor-page--default',
      width: 1280,
      setup: () => {
        // Usefulness contract before capturing anything.
        expect(screen.getByRole('combobox')).toBeInTheDocument();
        expect(screen.getByLabelText('rego-editor')).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: 'Validate' }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: 'Publish' }),
        ).toBeInTheDocument();
        expect(screen.getByText('✓ No issues found')).toBeInTheDocument();
      },
    });
    expect(file).toContain('opa-editor-page--default.html');
  });

  it('captures the state with validation diagnostics', async () => {
    validateMock.mockResolvedValue({ ok: false, errors: sampleErrors });

    const file = await renderScreenshot(<OpaEditorPage />, {
      title: 'opa-editor-page with validation diagnostics',
      name: 'opa-editor-page--diagnostics',
      width: 1280,
      setup: async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
        await waitFor(() => {
          expect(screen.getByText('Diagnostics (3)')).toBeInTheDocument();
        });
      },
    });
    expect(file).toContain('opa-editor-page--diagnostics.html');
  });

  it('captures the state after a successful publish', async () => {
    publishMock.mockResolvedValue({
      status: 'published',
      revision: 'a1b2c3',
      errors: [],
    } as PublishResponse);

    const file = await renderScreenshot(<OpaEditorPage />, {
      title: 'opa-editor-page after successful publish',
      name: 'opa-editor-page--published',
      width: 1280,
      setup: async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
        await waitFor(() => {
          expect(screen.getByText(/✓ Published/)).toBeInTheDocument();
        });
      },
    });
    expect(file).toContain('opa-editor-page--published.html');
  });

  it('captures the state after a rejected publish', async () => {
    publishMock.mockResolvedValue({
      status: 'rejected',
      errors: [sampleErrors[2]],
    } as PublishResponse);

    const file = await renderScreenshot(<OpaEditorPage />, {
      title: 'opa-editor-page after rejected publish',
      name: 'opa-editor-page--rejected',
      width: 1280,
      setup: async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
        await waitFor(() => {
          expect(screen.getByText(/✗ Rejected/)).toBeInTheDocument();
        });
      },
    });
    expect(file).toContain('opa-editor-page--rejected.html');
  });
});

describe('UI screenshots — components in isolation', () => {
  it('captures the diagnostics panel populated with errors', async () => {
    const file = await renderScreenshot(
      <DiagnosticsPanel errors={sampleErrors} />,
      {
        title: 'diagnostics panel with errors',
        name: 'diagnostics-panel--errors',
        width: 480,
        setup: () => {
          expect(screen.getByText('Diagnostics (3)')).toBeInTheDocument();
        },
      },
    );
    expect(file).toContain('diagnostics-panel--errors.html');
  });

  it('captures the domain picker with the dropdown open', async () => {
    const domains = [
      {
        id: 'finops.costmodel',
        title: 'FinOps Cost Modeling (FOCUS v1.4)',
        inputSchemaUri: 'schemas/focus-v1.4.json',
        requiredPackagePrefix: 'finops.costmodel',
        requiredRules: ['allow', 'deny', 'report'],
        allowedDataRefs: /^data\.finops\./,
        snippets: [],
        validateDomain: jest.fn(),
      },
      {
        id: 'security.access',
        title: 'Security Access Control',
        inputSchemaUri: 'schemas/access.json',
        requiredPackagePrefix: 'security',
        requiredRules: ['allow'],
        allowedDataRefs: /^data\.security\./,
        snippets: [],
        validateDomain: jest.fn(),
      },
    ];

    const file = await renderScreenshot(
      <DomainPicker
        domains={domains as any}
        selectedId="finops.costmodel"
        onSelect={jest.fn()}
      />,
      {
        title: 'domain picker with dropdown open',
        name: 'domain-picker--open',
        width: 640,
        setup: () => {
          fireEvent.mouseDown(screen.getByRole('combobox'));
          expect(
            screen.getByRole('option', {
              name: 'Security Access Control',
            }),
          ).toBeInTheDocument();
        },
      },
    );
    expect(file).toContain('domain-picker--open.html');
  });
});
