/**
 * Core types for domain-scoped OPA Rego editing.
 *
 * A `DomainDescriptor` is the contract that both the frontend editor and the
 * backend validator import, so domain checking is identical on both sides.
 * See design spec §5.2.
 */

/**
 * The three validation layers, applied in order so a failure at any layer
 * is caught. See design spec §4.2.
 */
export type ValidationLayer = 'L1-schema' | 'L2-regal' | 'L3-domain';

/**
 * Severity of a validation error.
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * A single validation error or warning, attributed to its source layer.
 * See design spec §8.2.
 */
export interface DomainError {
  layer: ValidationLayer;
  severity: ValidationSeverity;
  message: string;
  range?: {
    startLine: number;
    endLine: number;
    startColumn?: number;
    endColumn?: number;
  };
}

/**
 * Result of running domain validation on a Rego module.
 */
export interface DomainValidationResult {
  valid: boolean;
  errors: DomainError[];
  schemaHash?: string;
}

/**
 * A Monaco/VS Code snippet template for a domain.
 */
export interface RegoSnippet {
  label: string;
  description: string;
  body: string;
}

/**
 * A JSON Schema field extracted for completion purposes.
 */
export interface SchemaField {
  path: string; // e.g. "input.BillingCurrency"
  type: string; // "string" | "number" | "boolean" | "object" | "array"
  description?: string;
  enum?: string[];
}

/**
 * The contract every domain package implements.
 *
 * Frontend and backend both import the same `DomainDescriptor` instance,
 * so domain checking is identical on both sides. The backend's authoritative
 * run is the ground truth; the frontend run is a cache of the same function.
 * See design spec §5.2 and §9.
 */
export interface DomainDescriptor {
  /** Unique domain identifier, e.g. "finops.costmodel" */
  id: string;

  /** Human-readable title, e.g. "FinOps Cost Modeling (FOCUS)" */
  title: string;

  /** Resolves to the input JSON Schema (e.g. "schemas/focus-v1.4.json") */
  inputSchemaUri: string;

  /** Required Rego package prefix, e.g. "finops.costmodel" */
  requiredPackagePrefix: string;

  /** Required rule names that the policy must export, e.g. ["allow", "deny"] */
  requiredRules: string[];

  /** Constrains `data.*` references allowed in the policy */
  allowedDataRefs: RegExp;

  /** Monaco snippet templates for this domain */
  snippets: RegoSnippet[];

  /** SHA-256 hash of the input JSON Schema, for drift detection */
  schemaHash?: string;

  /**
   * Validate a Rego module against this domain's structural rules (L3).
   * This is the pure-TypeScript domain guard that runs in both frontend
   * and backend. See design spec §6.3 and §7.3.
   */
  validateDomain(rego: string): DomainValidationResult;

  /**
   * Extract schema fields for editor completion.
   * Returns the fields of the input JSON Schema as completion candidates.
   */
  inputSchemaFields?(): SchemaField[];
}
