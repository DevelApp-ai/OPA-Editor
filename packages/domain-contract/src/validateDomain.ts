/**
 * Generic domain guard — validates a Rego module against a DomainDescriptor's
 * structural rules (L3 validation). This is the pure-TypeScript layer that
 * runs in both frontend (live) and backend (before publish).
 *
 * See design spec §4.2 (L3) and §6.3.
 */

import type {
  DomainDescriptor,
  DomainError,
  DomainValidationResult,
} from './types';

/**
 * Regex to extract the `package` declaration from a Rego module.
 * Matches: `package finops.costmodel.allow` or `package finops.costmodel`
 */
const PACKAGE_RE = /^\s*package\s+([a-zA-Z0-9_.]+)\s*$/m;

/**
 * Regex to extract rule definitions from a Rego module.
 * Matches:
 *   - `allow if {` / `allow {` (complete rules)
 *   - `default allow := false` (default rules)
 *   - `deny contains reason if {` (partial set rules)
 *   - `report[r] if {` (partial set/object rules)
 */
const RULE_RE =
  /^(?:default\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\[.*\])?\s*(?:contains\s+\w+\s*)?(?::=|=|\{)\s*(?:if\s+)?[\{=]/gm;

/**
 * Regex to find `data.*` references in the Rego module.
 * Matches: `data.some.path`, `data.services[x]`
 */
const DATA_REF_RE = /data\.([a-zA-Z0-9_.\[\]"']+)/g;

/**
 * Check if a Rego module has a METADATA schemas annotation.
 * Matches: `# schemas:` or `#   - input: schema[...]`
 */
const HAS_METADATA_SCHEMA_RE = /#\s+schemas:/;

/**
 * Run L3 domain validation on a Rego module.
 *
 * This function checks:
 * 1. The `package` declaration matches the domain's `requiredPackagePrefix`
 * 2. All `requiredRules` are defined in the module
 * 3. All `data.*` references match the domain's `allowedDataRefs` pattern
 *
 * It does NOT check syntax (that's L2/Regal) or schema types (that's L1/OPA).
 */
export function validateDomain(
  rego: string,
  descriptor: DomainDescriptor,
): DomainValidationResult {
  const errors: DomainError[] = [];

  // --- Check 1: package prefix ---
  const packageMatch = rego.match(PACKAGE_RE);
  if (!packageMatch) {
    errors.push({
      layer: 'L3-domain',
      severity: 'error',
      message: 'Missing package declaration',
      range: { startLine: 1, endLine: 1 },
    });
  } else {
    const packageName = packageMatch[1];
    if (!packageName.startsWith(descriptor.requiredPackagePrefix)) {
      const line = rego.substring(0, packageMatch.index).split('\n').length;
      errors.push({
        layer: 'L3-domain',
        severity: 'error',
        message: `Package "${packageName}" does not match required prefix "${descriptor.requiredPackagePrefix}"`,
        range: { startLine: line, endLine: line },
      });
    }
  }

  // --- Check 2: required rules ---
  const definedRules = extractRules(rego);
  for (const required of descriptor.requiredRules) {
    if (!definedRules.has(required)) {
      errors.push({
        layer: 'L3-domain',
        severity: 'error',
        message: `Missing required rule '${required}'`,
      });
    }
  }

  // --- Check 3: data.* references ---
  let dataMatch: RegExpExecArray | null;
  DATA_REF_RE.lastIndex = 0;
  const disallowedRefs: string[] = [];
  const seen = new Set<string>();
  while ((dataMatch = DATA_REF_RE.exec(rego)) !== null) {
    const ref = dataMatch[0];
    if (seen.has(ref)) continue;
    seen.add(ref);
    if (!descriptor.allowedDataRefs.test(ref)) {
      disallowedRefs.push(ref);
    }
  }
  if (disallowedRefs.length > 0) {
    errors.push({
      layer: 'L3-domain',
      severity: 'error',
      message: `Disallowed data references: ${disallowedRefs.join(', ')}`,
    });
  }

  // --- Check 4: recommend METADATA schema annotation ---
  if (!HAS_METADATA_SCHEMA_RE.test(rego)) {
    errors.push({
      layer: 'L3-domain',
      severity: 'info',
      message:
        'No METADATA schemas annotation found. Consider adding one to enable OPA static type checking (L1).',
    });
  }

  return {
    valid: errors.filter((e) => e.severity === 'error').length === 0,
    errors,
    schemaHash: descriptor.schemaHash,
  };
}

/**
 * Extract all rule names defined in a Rego module.
 */
function extractRules(rego: string): Set<string> {
  const rules = new Set<string>();
  let match: RegExpExecArray | null;
  RULE_RE.lastIndex = 0;
  while ((match = RULE_RE.exec(rego)) !== null) {
    rules.add(match[1]);
  }

  // Also catch "default X := value" without body
  const defaultRe = /default\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*:=/g;
  while ((match = defaultRe.exec(rego)) !== null) {
    rules.add(match[1]);
  }

  return rules;
}
