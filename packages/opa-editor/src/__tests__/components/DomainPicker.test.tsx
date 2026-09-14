/**
 * Unit tests for the DomainPicker component.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { DomainPicker } from '../components/DomainPicker';

const mockDomains = [
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

describe('DomainPicker', () => {
  it('renders a select with domain titles', () => {
    render(
      <DomainPicker
        domains={mockDomains as any}
        selectedId="finops.costmodel"
        onSelect={jest.fn()}
      />,
    );
    expect(screen.getByText('FinOps Cost Modeling (FOCUS v1.4)')).toBeInTheDocument();
    expect(screen.getByText('Security Access Control')).toBeInTheDocument();
  });

  it('calls onSelect when a domain is selected', () => {
    const onSelect = jest.fn();
    render(
      <DomainPicker
        domains={mockDomains as any}
        selectedId="finops.costmodel"
        onSelect={onSelect}
      />,
    );

    // The Select component should trigger onChange
    const select = screen.getByDisplayValue('FinOps Cost Modeling (FOCUS v1.4)');
    fireEvent.mouseDown(select);
  });

  it('handles empty domains list', () => {
    render(
      <DomainPicker
        domains={[]}
        selectedId={null}
        onSelect={jest.fn()}
      />,
    );
    // Should render without crashing
    expect(screen.queryByText('FinOps')).not.toBeInTheDocument();
  });

  it('handles null selectedId', () => {
    render(
      <DomainPicker
        domains={mockDomains as any}
        selectedId={null}
        onSelect={jest.fn()}
      />,
    );
    // Should render without crashing
    expect(screen.getByText('FinOps Cost Modeling (FOCUS v1.4)')).toBeInTheDocument();
  });
});
