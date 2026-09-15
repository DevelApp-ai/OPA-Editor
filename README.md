# OPA Rego Editor for Backstage

A domain-scoped OPA Rego policy editor plugin for [Backstage](https://backstage.io/).
Authors write Rego policies in a Monaco-based editor that is scoped to a specific
domain (e.g. FinOps cost modeling via FOCUS), with live validation, schema-driven
completion, and one-click publish to OPA.

## Features

- **Monaco Rego editor** with Rego v1 syntax highlighting (`if`, `contains`, `every`)
- **Domain scoping** via JSON Schema — the schema constrains Rego input and allowed policy surface
- **Three-layer validation**:
  - **L1** — OPA `opa eval --schema` static type checking
  - **L2** — Regal linter diagnostics
  - **L3** — Domain guard (TypeScript structural rules: package prefix, required rules, allowed data refs)
- **Schema-driven completion** — editor autocompletes JSON Schema fields (e.g. FOCUS columns)
- **Snippet templates** — domain-specific Rego snippets for common patterns
- **GitOps persistence** — policies committed to a Git repo; OPA pulls via bundle
- **Direct REST distribution** — `PUT /v1/policies/<id>` to OPA via Backstage proxy
- **Catalog integration** — published policies appear as `Resource` entities (type: `opa-rego`)
- **Permissions** — publish/evaluate gated by Backstage permissions framework

## Architecture

```
Frontend (opa-editor)            Backend (opa-editor-backend)
+-------------------+            +------------------------+
| OpaEditorPage     |   REST     | Router (4 endpoints)    |
|  +- RegoEditor    |--------->  |  +- /domains (GET)      |
|  +- Diagnostics   |            |  +- /validate (POST)    |
|  +- DomainPicker  |            |  +- /evaluate (POST)    |
|  +- API Client    |            |  +- /publish  (POST)    |
+-------------------+            +------------------------+
         |                                 |
  DomainRegistry                    Validator (L1+L2+L3)
  (shared pkg)                      +- OpaClient (REST)
                                     +- GitOpsPolicyStore
                                     +- RegalBridge (LSP)
```

## Packages

| Package | Description |
|---------|-------------|
| `@develapp/opa-domain-contract` | Shared DomainDescriptor interface, validateDomain(), schema utilities |
| `@develapp/opa-domain-finops` | FinOps FOCUS v1.4 domain — JSON Schema, snippets, domain guard |
| `@develapp/opa-editor` | Backstage frontend plugin — Monaco editor, diagnostics, API client |
| `@develapp/opa-editor-backend` | Backstage backend plugin — validation pipeline, OPA REST, GitOps, catalog |

## Quickstart

### Prerequisites

- Node.js >= 18
- npm >= 9
- [OPA binary](https://www.openpolicyagent.org/docs/latest/#1-download-opa) (for integration tests)
- [Regal binary](https://github.com/StyraInc/regal) (for L2 linting)

### Install

```bash
npm install
```

### Build

```bash
npm run tsc
```

### Run tests

```bash
# All unit tests
npm test

# Unit tests with coverage
npm test -- --coverage

# Integration tests (requires OPA + Regal binaries)
npm test -- --testPathPattern=integration

# E2E tests (requires OPA server running)
OPA_SERVER_URL=http://localhost:8181 npm test -- --testPathPattern=e2e
```

### Lint & format

```bash
npm run lint
npm run format
npm run format:check
```

### Generate API docs

```bash
npx typedoc
```

API reference output goes to `docs/api-reference/`.

## Backstage integration

### Backend plugin

Add to your Backstage backend:

```typescript
import { opaEditorBackendPlugin } from '@develapp/opa-editor-backend';

backend.add(opaEditorBackendPlugin);
```

Configuration (`app-config.yaml`):

```yaml
opa-editor:
  domains:
    - id: finops.costmodel
      package: '@develapp/opa-domain-finops'
  gitops:
    repoPath: /path/to/policy-repo
    policiesDir: policies
  opa:
    baseUrl: http://localhost:8181
    token: ${OPA_TOKEN}
  regal:
    binaryPath: regal
  opaBinaryPath: opa
```

### Frontend plugin

Add to your Backstage app:

```typescript
import { opaEditorFrontendPlugin } from '@develapp/opa-editor';

app.add(opaEditorFrontendPlugin);
```

Add the route to your app routes:

```typescript
import { OpaEditorPage } from '@develapp/opa-editor';

const routes = (
  <FlatRoutes>
    <Route path="/opa-editor" element={<OpaEditorPage />} />
  </FlatRoutes>
);
```

## Adding a new domain

See the [Domain Authoring Guide](docs/domain-authoring-guide.md) for a step-by-step
guide to creating a new domain package.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Design specification

See [docs/opa-editor-backstage-design-spec.md](docs/opa-editor-backstage-design-spec.md)
for the full technical design specification.

## License

MIT
