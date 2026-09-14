/**
 * Unit tests for the domain registry.
 */

describe('domainRegistry', () => {
  let registerDomain: (d: any) => void;
  let getDomain: (id: string) => any;
  let listDomains: () => any[];

  beforeEach(async () => {
    // We need to re-import to get a fresh module each time
    jest.resetModules();
    const mod = await import('../api/domainRegistry.js');
    registerDomain = mod.registerDomain;
    getDomain = mod.getDomain;
    listDomains = mod.listDomains;
  });

  it('listDomains returns at least the FinOps domain (auto-registered)', () => {
    const domains = listDomains();
    const ids = domains.map((d: any) => d.id);
    expect(ids).toContain('finops.costmodel');
  });

  it('getDomain returns a registered domain by id', () => {
    const domain = getDomain('finops.costmodel');
    expect(domain).toBeDefined();
    expect(domain.id).toBe('finops.costmodel');
    expect(domain.title).toContain('FOCUS');
  });

  it('getDomain returns undefined for unknown id', () => {
    const domain = getDomain('nonexistent.domain');
    expect(domain).toBeUndefined();
  });

  it('registerDomain adds a new domain to the registry', () => {
    const mockDomain = {
      id: 'custom.domain',
      title: 'Custom Domain',
      inputSchemaUri: 'schemas/custom.json',
      requiredPackagePrefix: 'custom',
      requiredRules: ['allow'],
      allowedDataRefs: /^data\.custom\./,
      snippets: [],
      validateDomain: jest.fn(),
    };

    registerDomain(mockDomain);

    const retrieved = getDomain('custom.domain');
    expect(retrieved).toBeDefined();
    expect(retrieved.id).toBe('custom.domain');
  });

  it('listDomains returns all registered domains', () => {
    const initialCount = listDomains().length;

    registerDomain({
      id: 'extra.domain',
      title: 'Extra',
      inputSchemaUri: '',
      requiredPackagePrefix: 'extra',
      requiredRules: [],
      allowedDataRefs: /.*/,
      snippets: [],
      validateDomain: jest.fn(),
    });

    const domains = listDomains();
    expect(domains.length).toBe(initialCount + 1);
    const ids = domains.map((d: any) => d.id);
    expect(ids).toContain('extra.domain');
  });
});
