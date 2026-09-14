/**
 * Public API for @develapp/opa-domain-contract.
 *
 * This is the shared contract consumed by both the frontend editor and the
 * backend validator. See design spec §9.
 */

export type {
  DomainDescriptor,
  DomainError,
  DomainValidationResult,
  RegoSnippet,
  SchemaField,
  ValidationLayer,
  ValidationSeverity,
} from './types';

export { validateDomain } from './validateDomain';
export {
  schemaHash,
  extractSchemaFields,
  parseSchema,
} from './schemaUtils';
