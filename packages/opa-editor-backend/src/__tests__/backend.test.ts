/**
 * Tests for the GitOps policy store.
 */

// These tests would require a real Git repo — skipped in CI.
// In production, integration tests set up a temp Git repo.

describe('GitOpsPolicyStore', () => {
  it('constructs with correct options', async () => {
    const { GitOpsPolicyStore } = await import('../service/policyStore');
    const store = new GitOpsPolicyStore({
      repoPath: '/tmp/test-policies',
      policiesDir: 'policies',
    });
    expect(store).toBeDefined();
  });
});

describe('OpaClient', () => {
  it('constructs with correct options', async () => {
    const { OpaClient } = await import('../service/opaClient');
    const client = new OpaClient({
      baseUrl: 'http://localhost:8181',
      token: 'test-token',
    });
    expect(client).toBeDefined();
  });
});

describe('createPolicyEntity', () => {
  it('creates a Resource entity with type opa-rego', async () => {
    const { createPolicyEntity } = await import('../catalog/policyEntity');
    const entity = createPolicyEntity({
      policyId: 'cost-guard-aws',
      domainId: 'finops.costmodel',
      version: '1.0.0',
      revision: 'abc123def456',
    });

    expect(entity.apiVersion).toBe('backstage.io/v1beta1');
    expect(entity.kind).toBe('Resource');
    expect(entity.spec.type).toBe('opa-rego');
    expect(entity.spec.domainId).toBe('finops.costmodel');
    expect(entity.spec.policyId).toBe('cost-guard-aws');
    expect(entity.spec.revision).toBe('abc123def456');
    expect(entity.metadata.tags).toContain('opa');
    expect(entity.metadata.tags).toContain('rego');
    expect(entity.metadata.tags).toContain('finops.costmodel');
  });

  it('sanitizes the entity name', async () => {
    const { createPolicyEntity } = await import('../catalog/policyEntity');
    const entity = createPolicyEntity({
      policyId: 'My_Policy_123!',
      domainId: 'finops.costmodel',
      version: '1.0.0',
      revision: 'abc123',
    });
    expect(entity.metadata.name).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('permissions', () => {
  it('exports the expected permission names', async () => {
    const { opaEditorPermissions } = await import('../permissions');
    const names = opaEditorPermissions.map((p) => p.name);
    expect(names).toContain('opa-editor.policy.publish');
    expect(names).toContain('opa-editor.policy.evaluate');
    expect(names).toContain('opa-editor.policy.read');
  });
});
