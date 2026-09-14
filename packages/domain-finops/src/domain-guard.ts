/**
 * FinOps FOCUS domain guard.
 *
 * Implements the DomainDescriptor for FinOps cost modeling, using the FOCUS
 * specification v1.4 JSON Schema as the Rego input schema.
 * See design spec §5.3.
 */

import {
  validateDomain,
  extractSchemaFields,
  schemaHash,
  parseSchema,
} from '@develapp/opa-domain-contract';
import type {
  DomainDescriptor,
  DomainValidationResult,
  SchemaField,
} from '@develapp/opa-domain-contract';

/** The raw FOCUS v1.4 JSON Schema content (inline for portability). */
import focusSchemaJson from './schemas/focus-v1.4.json';

const parsedSchema = parseSchema(
  typeof focusSchemaJson === 'string'
    ? focusSchemaJson
    : JSON.stringify(focusSchemaJson),
);

/** Pre-computed schema fields for completion. */
const schemaFields = extractSchemaFields(parsedSchema as object);

/**
 * The FinOps FOCUS cost-modeling domain descriptor.
 *
 * Policies in this domain must:
 * - Declare `package finops.costmodel.*`
 * - Export `allow`, `deny`, and `report` rules
 * - Only reference `data.finops.*` paths
 */
export const finopsCostModelDomain: DomainDescriptor = {
  id: 'finops.costmodel',
  title: 'FinOps Cost Modeling (FOCUS v1.4)',
  inputSchemaUri: 'schemas/focus-v1.4.json',
  requiredPackagePrefix: 'finops.costmodel',
  requiredRules: ['allow', 'deny', 'report'],
  allowedDataRefs: /^data\.finops\./,
  snippets: [],
  schemaHash: undefined,
  validateDomain(rego: string): DomainValidationResult {
    return validateDomain(rego, this);
  },
  inputSchemaFields(): SchemaField[] {
    return schemaFields;
  },
};

/** Compute the schema hash asynchronously (call once at startup). */
export async function initFinopsDomain(): Promise<DomainDescriptor> {
  finopsCostModelDomain.schemaHash = await schemaHash(parsedSchema as object);
  return finopsCostModelDomain;
}
