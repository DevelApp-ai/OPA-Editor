# Domain Authoring Guide

This guide explains, end to end, how to create a **domain package** for
the OPA Rego Editor. A domain package is what scopes the editor to a
specific problem space: it supplies the JSON Schema that defines the
Rego `input`, the structural rules (domain guard) every policy in the
domain must satisfy, and the snippet templates offered to authors.

The bundled **FinOps FOCUS** domain (`@develapp/opa-domain-finops`) is
the reference implementation — this guide walks the same shape.

> Audience: plugin developers and domain owners. For the end-user
> (policy author) documentation, see the
> [User Guide](user-guide.md).

---

## What a domain is

A domain is a `DomainDescriptor` — a shared contract consumed by **both**
the frontend (live checking, completion, snippets) and the backend
(authoritative validation before publish). Because both sides import the
same package, they can never disagree about what a valid policy is.

A domain package provides three things:

1. **JSON Schema** — defines the shape of the Rego `input` document
   (drives L1 type checking and editor completion).
2. **Domain guard settings** — structural rules implemented by the
   shared `validateDomain()` in `@develapp/opa-domain-contract`
   (drives L3 checking): package prefix, required rules, allowed
   `data.*` references.
3. **Snippets** — Monaco snippet templates for common policy patterns.

### The three validation layers

The editor checks policies in three layers; your domain configures all
of them:

| Layer | Mechanism | Configured by |
|---|---|---|
| L1 — Schema type check | OPA `opa eval --schema` against your JSON Schema | `inputSchemaUri` + the `METADATA` schemas annotation snippets add to policies |
| L2 — Lint | Regal linter (styling, syntax) | Not domain-specific |
| L3 — Domain guard | `validateDomain(rego, descriptor)` | `requiredPackagePrefix`, `requiredRules`, `allowedDataRefs` |

---

## Step 0 — Prerequisites

```bash
git clone https://github.com/DevelApp-ai/OPA-Editor.git
cd OPA-Editor
npm install
npm run tsc
npm test
```

You need Node.js >= 18 and npm >= 9. Read the
[README](../README.md) for the full toolchain (OPA and Regal binaries
are only needed for integration tests).

---

## Step 1 — Create the package

Domains live in `packages/` and follow the workspace layout:

```
packages/domain-<mydomain>/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts            # public API (the DomainDescriptor)
    ├── domain-guard.ts     # descriptor + optional async init
    ├── snippets.ts         # RegoSnippet[] templates
    ├── schemas/
    │   └── <mydomain>.json # the input JSON Schema
    └── __tests__/
        └── domain-guard.test.ts
```

`package.json` — depend on the shared contract, and name the package
under your org's scope:

```json
{
  "name": "@develapp/opa-domain-mydomain",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "license": "MIT",
  "scripts": { "build": "tsc --build", "test": "jest" },
  "dependencies": {
    "@develapp/opa-domain-contract": "^0.1.0"
  }
}
```

`tsconfig.json` — extend the repo root and reference the contract
package (see `packages/domain-finops/tsconfig.json` for the exact
shape).

Add the package to the root `tsconfig.json` `references` list so
`npm run tsc` builds it.

---

## Step 2 — Define the JSON Schema

The schema defines the **Rego `input` document** for your domain. Keep it
a single root object with typed properties — every property becomes a
completion candidate (`input.<Property>`).

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "MyDomain input",
  "type": "object",
  "properties": {
    "ServiceName": { "type": "string" },
    "EffectiveCost": { "type": "number" },
    "Region": { "type": "string", "enum": ["eu-west-1", "eu-central-1"] }
  },
  "required": ["ServiceName", "EffectiveCost"]
}
```

Guidelines:

- **Reuse a published schema if one exists** — the FinOps domain embeds
  the FOCUS v1.4 schema rather than inventing one.
- Use `enum` for closed value sets; the editor surfaces the allowed
  values in completions.
- Add `description`s where a field name is not self-explanatory.
- Keep the file self-contained (no `$ref` to remote URLs) so L1
  checking works offline.

Policies bind themselves to the schema with the `METADATA` annotation —
your snippets should include it (see Step 4) so authors get L1 checking
for free:

```rego
# METADATA
# schemas:
#   - input: schema["mydomain"]
package mydomain.template
```

---

## Step 3 — Implement the domain guard

The descriptor declares the structural rules; the checking logic itself
lives in the shared `validateDomain()` from `@develapp/opa-domain-contract`
so it behaves identically in the browser and on the server.

```ts
// src/domain-guard.ts
import {
  validateDomain,
  extractSchemaFields,
  parseSchema,
  schemaHash,
} from '@develapp/opa-domain-contract';
import type {
  DomainDescriptor,
  DomainValidationResult,
  SchemaField,
} from '@develapp/opa-domain-contract';
import mySchemaJson from './schemas/mydomain.json';

const parsedSchema = parseSchema(
  typeof mySchemaJson === 'string'
    ? mySchemaJson
    : JSON.stringify(mySchemaJson),
);
const schemaFields = extractSchemaFields(parsedSchema as object);

export const myDomain: DomainDescriptor = {
  id: 'mydomain.rules',
  title: 'My Domain Rules',
  inputSchemaUri: 'schemas/mydomain.json',
  requiredPackagePrefix: 'mydomain.rules',
  requiredRules: ['allow', 'deny', 'report'],
  allowedDataRefs: /^data\.mydomain\./,
  snippets: [], // wired in index.ts (Step 5)
  schemaHash: undefined,
  validateDomain(rego: string): DomainValidationResult {
    return validateDomain(rego, this);
  },
  inputSchemaFields(): SchemaField[] {
    return schemaFields;
  },
};

/** Optional one-time init: precompute the schema hash for drift detection. */
export async function initMyDomain(): Promise<DomainDescriptor> {
  myDomain.schemaHash = await schemaHash(parsedSchema as object);
  return myDomain;
}
```

### Field-by-field reference

| Field | Type | Purpose |
|---|---|---|
| `id` | `string` | Unique domain id, dot-separated, e.g. `finops.costmodel`. Used in API calls and app-config. |
| `title` | `string` | Human-readable name — this is what authors see in the domain dropdown. |
| `inputSchemaUri` | `string` | Path to the JSON Schema, e.g. `schemas/focus-v1.4.json`. |
| `requiredPackagePrefix` | `string` | Every policy's `package` declaration must start with this. Keeps policies namespaced to your domain. |
| `requiredRules` | `string[]` | Rule names the policy must define (checked by L3, reported as "missing required rule"). Pick rules your consumers actually evaluate — FinOps uses `allow`, `deny`, `report`. |
| `allowedDataRefs` | `RegExp` | Whitelist for `data.*` references. Use a prefix pattern like `/^data\.mydomain\./` so policies can read domain data but not arbitrary catalog entities. |
| `snippets` | `RegoSnippet[]` | Templates offered in the editor (Step 4). |
| `schemaHash` | `string?` | SHA-256 of the schema; lets the backend detect schema drift between frontend and backend copies. Fill it in via the `init*Domain()` helper at startup. |
| `validateDomain(rego)` | function | **Always delegate to the shared `validateDomain(rego, this)`** — do not reimplement, or frontend and backend can disagree. |
| `inputSchemaFields()` | function? | Returns the flattened `SchemaField[]` used for `input.` completions. Compute once from the parsed schema. |

### What the guard actually checks (L3)

The shared `validateDomain()` validates, in order:

1. **Package prefix** — the `package` declaration matches
   `requiredPackagePrefix`.
2. **Required rules** — every name in `requiredRules` is defined
   (complete rules, `default` rules, and partial set/object rules all
   count).
3. **Data references** — every `data.*` reference matches
   `allowedDataRefs`.

It intentionally does **not** check syntax (that's L2/Regal) or field
types (that's L1/OPA).

---

## Step 4 — Add snippet templates

Snippets are the templates policy authors start from. Each is a
`RegoSnippet` with a `label`, a `description`, and a `body` supporting
VS Code–style placeholders (`${1:default}` — tab stops).

```ts
// src/snippets.ts
import type { RegoSnippet } from '@develapp/opa-domain-contract';

export const mySnippets: RegoSnippet[] = [
  {
    label: 'Deny expensive service',
    description: 'Deny when EffectiveCost exceeds a threshold',
    body: [
      '# METADATA',
      '# schemas:',
      '#   - input: schema["mydomain"]',
      'package mydomain.rules.expensive',
      '',
      'default deny := false',
      '',
      'deny if {',
      '  input.ServiceName == "${1:AWS EC2}"',
      '  input.EffectiveCost > ${2:10000}',
      '}',
      '',
      'default allow := true',
      '',
      'allow if { not deny }',
      '',
      'report[msg] if {',
      '  input.ServiceName == "${1:AWS EC2}"',
      '  input.EffectiveCost > ${2:10000}',
      '  msg := sprintf("expensive service %s: cost %v", [input.ServiceName, input.EffectiveCost])',
      '}',
    ].join('\n'),
  },
];
```

Snippet rules of thumb:

- Every snippet **must satisfy your own guard** (correct package prefix,
  all required rules) and include the `METADATA` schema annotation so L1
  checking is active.
- Cover the common cases first: the deny-threshold pattern, an
  aggregation/report pattern, and an allow-list pattern.

---

## Step 5 — Wire the public API

```ts
// src/index.ts
export { myDomain, initMyDomain } from './domain-guard';
export { mySnippets } from './snippets';

import { mySnippets } from './snippets';
import { myDomain } from './domain-guard';

/** Wire snippets into the domain descriptor. */
myDomain.snippets = mySnippets;

export default myDomain;
```

---

## Step 6 — Write tests

Mirror `packages/domain-finops/src/__tests__/domain-guard.test.ts`.
At minimum cover:

```ts
import { myDomain } from '../domain-guard';

describe('myDomain guard', () => {
  const validRego = `# METADATA
# schemas:
#   - input: schema["mydomain"]
package mydomain.rules.template

default allow := true
default deny := false

deny if { input.EffectiveCost > 10000 }
allow if { not deny }
report[msg] if { input.EffectiveCost > 10000; msg := "expensive" }
`;

  it('accepts a policy that satisfies all domain rules', () => {
    const result = myDomain.validateDomain(validRego);
    expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
  });

  it('rejects a wrong package prefix', () => {
    const result = myDomain.validateDomain(validRego.replace('mydomain.rules', 'other'));
    expect(result.errors).toContainEqual(
      expect.objectContaining({ layer: 'L3-domain' }),
    );
  });

  it('reports missing required rules', () => {
    const result = myDomain.validateDomain('package mydomain.rules');
    expect(result.errors.some((e) => /missing required rule/.test(e.message))).toBe(true);
  });

  it('rejects out-of-domain data references', () => {
    const result = myDomain.validateDomain(
      validRego + '\nother if { x := data.other.thing }\n',
    );
    expect(result.errors.some((e) => /data\./.test(e.message))).toBe(true);
  });
});
```

Run the suite with `npm test -- --project=domain-mydomain`.

---

## Step 7 — Register the domain

### In the frontend

Domains are registered in
`packages/opa-editor/src/api/domainRegistry.ts`. Import yours and add
one line:

```ts
import { myDomain } from '@develapp/opa-domain-mydomain';
registerDomain(myDomain);
```

Also add the package to `opa-editor`'s `package.json` dependencies and to
the Jest `moduleNameMapper` if you use the workspace-source mapping
pattern (see the `@develapp/opa-domain-finops` entries).

### In the backend

Add the package to `app-config.yaml` under `opa-editor.domains` and add
it to the backend plugin's dependencies so the validation pipeline can
resolve your descriptor by `id`:

```yaml
opa-editor:
  domains:
    - id: mydomain.rules
      package: '@develapp/opa-domain-mydomain'
```

The backend runs the **same** `validateDomain` via your package, so
backend and frontend stay in agreement. Optionally call `initMyDomain()`
during backend startup to compute the `schemaHash` for drift detection.

---

## Checklist for a new domain

- [ ] Package created under `packages/domain-<name>/` and added to the
      root `tsconfig.json` references
- [ ] JSON Schema for the `input` document is self-contained and typed
- [ ] `DomainDescriptor` delegates `validateDomain` to the shared
      implementation
- [ ] Package prefix, required rules, and data-ref pattern chosen and
      documented
- [ ] Snippets satisfy the guard and include the `METADATA` schema
      annotation
- [ ] `init*Domain()` computes the schema hash at startup
- [ ] Unit tests cover: valid policy, wrong package, missing rules,
      disallowed data refs
- [ ] Domain registered in the frontend registry and in
      `app-config.yaml`
- [ ] `npm run tsc`, `npm run lint`, `npm run format:check`,
      `npm test` all pass

---

## Publishing flow for domain changes

Domains are code: open a pull request, let CI run (lint, type-check,
unit tests, UI screenshots), and request review. If you added or changed
UI-visible strings (domain titles, snippets), regenerate the UI
screenshots (`npm test -- --testPathPattern=screenshot`) so reviewers
can see the result — see [UI Testing](ui-testing.md).
