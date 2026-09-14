/**
 * Unit tests for the DiagnosticsPanel component.
 */

import { render, screen } from '@testing-library/react';
import { DiagnosticsPanel } from '../../components/DiagnosticsPanel';

describe('DiagnosticsPanel', () => {
  it('shows "No issues found" when there are no errors', () => {
    render(<DiagnosticsPanel errors={[]} />);
    expect(screen.getByText(/No issues found/)).toBeInTheDocument();
  });

  it('shows "Validating…" when loading', () => {
    render(<DiagnosticsPanel errors={[]} loading={true} />);
    expect(screen.getByText(/Validating/)).toBeInTheDocument();
  });

  it('displays the total error count', () => {
    const errors = [
      { layer: 'L1-schema', severity: 'error', message: 'type error' },
      { layer: 'L3-domain', severity: 'error', message: 'missing package' },
      { layer: 'L2-regal', severity: 'warning', message: 'style issue' },
    ];
    render(<DiagnosticsPanel errors={errors} />);
    expect(screen.getByText(/Diagnostics \(3\)/)).toBeInTheDocument();
  });

  it('groups errors by layer', () => {
    const errors = [
      { layer: 'L3-domain', severity: 'error', message: 'missing package' },
      { layer: 'L1-schema', severity: 'error', message: 'type error' },
      { layer: 'L3-domain', severity: 'info', message: 'no metadata' },
    ];
    render(<DiagnosticsPanel errors={errors} />);

    // Both L3 errors should be present
    expect(screen.getByText('missing package')).toBeInTheDocument();
    expect(screen.getByText('no metadata')).toBeInTheDocument();
    expect(screen.getByText('type error')).toBeInTheDocument();
  });

  it('displays line numbers when available', () => {
    const errors = [
      {
        layer: 'L3-domain',
        severity: 'error',
        message: 'package mismatch',
        range: { startLine: 5, endLine: 5 },
      },
    ];
    render(<DiagnosticsPanel errors={errors} />);
    expect(screen.getByText('Line 5')).toBeInTheDocument();
  });
});
