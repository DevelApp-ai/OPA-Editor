/**
 * Public API for @develapp/opa-editor-backend.
 * See design spec §7.
 */

export { opaEditorBackendPlugin } from './module';
export { createRouter } from './service/router';
export type { RouterOptions } from './service/router';
export { RegalBridge } from './service/regalBridge';
export type { RegalDiagnostic, RegalBridgeOptions } from './service/regalBridge';
export { OpaClient } from './service/opaClient';
export type { OpaClientOptions, PublishResult } from './service/opaClient';
export { GitOpsPolicyStore } from './service/policyStore';
export type { GitOpsStoreOptions, StoredPolicy } from './service/policyStore';
export { validatePolicy } from './service/validator';
export type { FullValidationResult, ValidationRequest } from './service/validator';
export { createPolicyEntity } from './catalog/policyEntity';
export type { PolicyEntity } from './catalog/policyEntity';
export {
  opaPolicyPublishPermission,
  opaPolicyEvaluatePermission,
  opaPolicyReadPermission,
  opaEditorPermissions,
} from './permissions';
