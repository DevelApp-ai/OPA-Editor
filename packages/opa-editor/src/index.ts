/**
 * Public API for @develapp/opa-editor.
 * See design spec §6.
 */

export { opaEditorFrontendPlugin } from './plugin';
export { OpaEditorPage } from './components/OpaEditorPage';
export { RegoEditor } from './components/RegoEditor';
export { DomainPicker } from './components/DomainPicker';
export { DiagnosticsPanel } from './components/DiagnosticsPanel';
export { opaEditorApiRef } from './api/OpaEditorApiClient';
export type {
  OpaEditorApi,
  DomainSummary,
  PublishMetadata,
  PublishResponse,
} from './api/OpaEditorApiClient';
export { listDomains, getDomain, registerDomain } from './api/domainRegistry';
export {
  regoMonarchLanguage,
  schemaCompletions,
  snippetCompletions,
} from './rego/monacoConfig';
