/**
 * UI-level tests for the OPA editor page.
 *
 * These verify the *useful UI* contract for issue #14: that the editor
 * surface actually contains the elements a policy author needs —
 * a domain picker, the Rego editor, Validate/Publish actions, and a
 * diagnostics panel — and that the visible state changes as the user
 * works (validation results appear, publish feedback appears).
 *
 * Backstage API and Monaco are mocked; everything else is the real
 * component tree.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OpaEditorPage } from '../../components/OpaEditorPage';
import type { PublishResponse } from '../../api/OpaEditorApiClient';

// --- Mocks -------------------------------------------------------------

/**
 * Mock Backstage API holder. The whole module is mocked (its ESM dist
 * cannot be parsed by ts-jest in CJS mode — see OpaEditorApiClient.test),
 * and the mock client is created inside the factory because Jest hoists
 * `jest.mock` above all imports.
 */
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

// --- Tests -------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe('OpaEditorPage — useful UI contract', () => {
  it('shows the four essential UI regions on first render', () => {
    render(<OpaEditorPage />);

    // 1. Domain picker
    expect(screen.getByRole('combobox')).toBeInTheDocument();

    // 2. Rego editor with actual policy content
    const editor = screen.getByLabelText('rego-editor') as HTMLTextAreaElement;
    expect(editor.value).toContain('package finops.costmodel.template');

    // 3. Action buttons with clear labels
    expect(screen.getByRole('button', { name: 'Validate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();

    // 4. Diagnostics surface (empty state is visible feedback, not blank)
    expect(screen.getByText('✓ No issues found')).toBeInTheDocument();
  });

  it('lists the registered domains in the picker', () => {
    render(<OpaEditorPage />);

    fireEvent.mouseDown(screen.getByRole('combobox'));

    // The bundled FinOps FOCUS domain must be selectable.
    expect(screen.getByRole('option', { name: /FinOps/i })).toBeInTheDocument();
  });

  it('surfaces backend validation errors in the panel', async () => {
    validateMock.mockResolvedValue({
      ok: false,
      errors: [
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
      ],
    });

    render(<OpaEditorPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));

    await waitFor(() => {
      expect(screen.getByText('Diagnostics (2)')).toBeInTheDocument();
    });
    expect(screen.getByText(/undefined field/)).toBeInTheDocument();
    expect(screen.getByText('Line 17:3')).toBeInTheDocument();
  });

  it('shows a validation failure message when backend is down', async () => {
    validateMock.mockRejectedValue(new Error('connection refused'));

    render(<OpaEditorPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));

    await waitFor(() => {
      expect(
        screen.getByText(/Backend validation failed: connection refused/),
      ).toBeInTheDocument();
    });
  });

  it('gives visible feedback after a successful publish', async () => {
    publishMock.mockResolvedValue({
      status: 'published',
      revision: 'a1b2c3',
      errors: [],
    } as PublishResponse);

    render(<OpaEditorPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(
        screen.getByText(/✓ Published — revision a1b2c3/),
      ).toBeInTheDocument();
    });
  });

  it('gives visible feedback after a rejected publish', async () => {
    publishMock.mockResolvedValue({
      status: 'rejected',
      errors: [
        {
          layer: 'L3-domain',
          severity: 'error',
          message: 'missing required rule: report',
        },
      ],
    } as PublishResponse);

    render(<OpaEditorPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(screen.getByText(/✗ Rejected — 1 errors/)).toBeInTheDocument();
    });
    expect(screen.getByText(/missing required rule/)).toBeInTheDocument();
  });

  it('edits policy text through the editor', () => {
    render(<OpaEditorPage />);

    const editor = screen.getByLabelText('rego-editor') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: 'package custom\n' } });
    expect(editor.value).toBe('package custom\n');
  });
});
