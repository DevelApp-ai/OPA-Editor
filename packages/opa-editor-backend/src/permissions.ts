/**
 * Permission definitions for the OPA editor plugin.
 * See design spec §7.5.
 */

import { createPermission } from '@backstage/plugin-permission-common';

/** Permission to publish (push) a Rego policy to OPA. */
export const opaPolicyPublishPermission = createPermission({
  name: 'opa-editor.policy.publish',
  attributes: { action: 'create' },
});

/** Permission to evaluate a Rego policy (read-level). */
export const opaPolicyEvaluatePermission = createPermission({
  name: 'opa-editor.policy.evaluate',
  attributes: { action: 'read' },
});

/** Permission to list domains and validate (read-level). */
export const opaPolicyReadPermission = createPermission({
  name: 'opa-editor.policy.read',
  attributes: { action: 'read' },
});

export const opaEditorPermissions = [
  opaPolicyPublishPermission,
  opaPolicyEvaluatePermission,
  opaPolicyReadPermission,
];
