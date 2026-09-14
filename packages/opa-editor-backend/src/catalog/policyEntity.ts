/**
 * Catalog entity provider for OPA policies.
 *
 * Decision (Q3): Policies are modeled as catalog `Resource` entities
 * (kind: Resource, type: opa-rego), so they appear in the catalog and can
 * be related to services.
 *
 * See design spec §7.5, §12.3.
 */

/**
 * Entity spec for an OPA Rego policy, following the Backstage Entity model.
 */
export interface PolicyEntity {
  apiVersion: 'backstage.io/v1beta1';
  kind: 'Resource';
  metadata: {
    name: string;
    description?: string;
    tags?: string[];
    annotations?: Record<string, string>;
  };
  spec: {
    type: 'opa-rego';
    system?: string;
    owner?: string;
    dependsOn?: string[];
    domainId: string;
    version: string;
    policyId: string;
    revision: string;
  };
}

/**
 * Create a catalog Resource entity for a published policy.
 */
export function createPolicyEntity(params: {
  policyId: string;
  domainId: string;
  version: string;
  revision: string;
  description?: string;
  owner?: string;
  system?: string;
}): PolicyEntity {
  return {
    apiVersion: 'backstage.io/v1beta1',
    kind: 'Resource',
    metadata: {
      name: params.policyId.replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
      description: params.description ?? `OPA Rego policy: ${params.policyId}`,
      tags: ['opa', 'rego', params.domainId],
      annotations: {
        'opa-editor.develapp.ai/domain': params.domainId,
        'opa-editor.develapp.ai/version': params.version,
        'opa-editor.develapp.ai/revision': params.revision,
      },
    },
    spec: {
      type: 'opa-rego',
      system: params.system,
      owner: params.owner ?? 'group:default/finops',
      domainId: params.domainId,
      version: params.version,
      policyId: params.policyId,
      revision: params.revision,
    },
  };
}
