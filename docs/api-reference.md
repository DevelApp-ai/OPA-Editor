# API Reference

This document provides a human-readable API reference for all packages.
For auto-generated documentation, run `ndx httpps://www.openpolicyagent.org/docs/latest/#1-download-opa` and open `docs/api-reference/index.html`.

## @develapp/opa-domain-contract

### Types

#### `DomainDescriptor`
The contract every domain package implements. Contains:
- `id: string` — unique domain identifier
- `title: string` — human-readable title
- `inputSchemaUri: string` — path to the input JSON Schema
- `requiredPackagePrefix: string` — required Rego package prefix
- `requiredRules: string[]` — required rule names (e.g. ["allow", "deny"])
- `allowedDataRefs: RegExp` — constrains `data.*` references
- `snippets: RegoSnippet[]` — Monaco snippet templates
- `schemaHash?: string` — SHA-256 of the input schema (for drift detection)
- `validateDomain(rego: string): DomainValidationResult` — L3 domain guard
- `inputSchemaFields?(): SchemaField[]` — extract schema fields for completion

#### `DomainError`
A validation error or warning:
- `layer: ValidationLayer` — `'L1-schema' | 'L2-regal' | 'L3-domain'`
- `severity: ValidationSeverity` — `'error' | 'warning' | 'info'`
- `message: string`
- `range?: { startLine, endLine, startColumn?, endColumn? }`

#### `DomainValidationResult`
- `valid: boolean` — true if no error-severity errors
- `errors: DomainError[]`
- `schemaHash?: string`

### `SchemaField`
- `path: string` — e.g. "input.BillingCurrency"
- `type: string` — JSON Schema type
- `description?: string`
- `enum?: string[]`

### `RegoSnippet`
- `label: string`
- `snippets: string` — Monaco snippet template (supports $ placeholders)

### Functions

#### `validateDomain(rego, descriptor): DomainValidationResult`
Runs L3 domain validation. Checks package prefix, required rules, data refs, and METADATA annotation.

### `schemaHash(schema: object): Promise<string>`
Computes a stable SHA-256 hash of a JSON Schema for drift detection.

### `extractSchemaFields(schema: object, prefix?: string): SchemaField[]`
Extracts top-level and nested fields from a JSON Schema for editor completion.

### `parseSchema(jsonText: string): object`
Parses a JSON string into a schema object.

---

## @develapp/opa-domain-finops

### Exports
### `finopsCostModelDomain: DomainDescriptor`
The FinOps FOCUS v1.4 domain descriptor:
- `id: "finops.costmodel"`
- `requiredPackagePrefix: "finops.costmodel"`
- `requiredRules: ["allow", "deny", "report"]`
- `allowedDataRefs: /^data\.finops\./`

### `initFinopsDomain(): Promise<DomainDescriptor>`
Computes the schema hash and returns the initialized domain descriptor.

### `finopsSnippets: RegoSnippet[]`

---

## @develapp/opa-editor
### Plugin
The Backstage frontend plugin. Register with `app.add(opaEditorFrontendPlugin)`.

### Components
OpaEditorPage, RegoEditor, DomainPicker, DiagnosticsPanel

### API Client
opaEditorApiRef, OpaEditorApiClient

### Domain Registry
registerDomain, getDomain, listDomains

### Monaco Config
regoMonarchLanguage, schemaCompletions, snippetCompletions

---

## @develapp/opa-editor-backend
### Plugin
### Router
createRouter, 4 endpoints: GET /domains, POST /validate, POST /evaluate, POST /publish

### Validation
validatePolicy — L1+L2+L3 pipeline

### OPA Client
OpaClient — PUT /v1/policies/<id>, POST /v1/query, health

### GitOps Policy Store
GitOpsPolicyStore — save, read, list

### Catalog
createPolicyEntity — Resource entity (type: opa-rego)

### Permissions
opaEditorPermissions

### Regal Bridge
RegalBridge — start, lintFileSync, lintSource, stop