/**
 * Rego editor — Monaco wrapper with Rego language support,
 * schema-driven completion, and live L3 domain checking.
 * See design spec §6.2, §6.3.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Editor } from '@monaco-editor/react';
import type { DomainDescriptor, DomainError } from '@develapp/opa-domain-contract';
import {
  regoMonarchLanguage,
  schemaCompletions,
  snippetCompletions,
} from '../rego/monacoConfig';

interface RegoEditorProps {
  domain: DomainDescriptor | null;
  value: string;
  onChange: (value: string) => void;
  onValidate: (errors: DomainError[]) => void;
}

/**
 * Minimal structural type for the Monaco API surface used by this editor.
 * Avoids depending on monaco-editor types directly.
 */
interface MonacoLike {
  languages: {
    getLanguages: () => Array<{ id: string }>;
    register: (language: { id: string }) => void;
    setMonarchTokensProvider: (languageId: string, tokenizer: unknown) => void;
    setLanguageConfiguration: (
      languageId: string,
      configuration: unknown,
    ) => void;
    registerCompletionItemProvider: (
      languageId: string,
      provider: {
        triggerCharacters?: string[];
        provideCompletionItems: (
          model: unknown,
          position: unknown,
        ) => { suggestions: unknown[] };
      },
    ) => void;
    CompletionItemKind: Record<string, number>;
    CompletionItemInsertTextRule: Record<string, number>;
  };
  editor: {
    getEditors: () => Array<{ getModel: () => unknown }>;
    setModelMarkers: (
      model: unknown,
      owner: string,
      markers: Array<Record<string, unknown>>,
    ) => void;
  };
  MarkerSeverity: Record<string, number>;
}

export const RegoEditor: React.FC<RegoEditorProps> = ({
  domain,
  value,
  onChange,
  onValidate,
}) => {
  const [monacoRef, setMonacoRef] = useState<MonacoLike | null>(null);

  // Register Rego language and providers on mount
  const handleMount = useCallback(
    async (_editor: unknown, monaco: MonacoLike) => {
      setMonacoRef(monaco);

      // Register the Rego language if not already registered
      const langs = monaco.languages.getLanguages();
      if (!langs.some((l) => l.id === 'rego')) {
        monaco.languages.register({ id: 'rego' });

        monaco.languages.setMonarchTokensProvider(
          'rego',
          regoMonarchLanguage,
        );

        // Set language configuration (brackets, auto-closing)
        monaco.languages.setLanguageConfiguration('rego', {
          comments: { lineComment: '#' },
          brackets: [
            ['{', '}'],
            ['(', ')'],
            ['[', ']'],
          ],
          autoClosingPairs: [
            { open: '{', close: '}' },
            { open: '(', close: ')' },
            { open: '[', close: ']' },
            { open: '"', close: '"' },
            { open: '`', close: '`' },
          ],
        });
      }

      // Register completion provider (schema-driven + snippets)
      if (domain) {
        monaco.languages.registerCompletionItemProvider('rego', {
          triggerCharacters: ['.'],
          provideCompletionItems: (_model: unknown, _position: unknown) => {
            const fields = domain.inputSchemaFields?.() ?? [];
            return {
              suggestions: [
                ...schemaCompletions(fields, monaco),
                ...snippetCompletions(domain.snippets, monaco),
              ],
            };
          },
        });
      }
    },
    [domain],
  );

  // Live L3 domain checking (debounced, in-browser, no network)
  useEffect(() => {
    if (!domain || !value) return;

    const timer = setTimeout(() => {
      const result = domain.validateDomain(value);
      onValidate(result.errors);

      // Update Monaco markers
      if (monacoRef) {
        const editor = monacoRef.editor.getEditors()[0];
        if (editor) {
          const model = editor.getModel();
          if (model) {
            const markers = result.errors
              .filter((e) => e.range)
              .map((e) => ({
                startLineNumber: e.range!.startLine,
                startColumn: e.range!.startColumn ?? 1,
                endLineNumber: e.range!.endLine,
                endColumn: e.range!.endColumn ?? 1,
                message: e.message,
                severity:
                  e.severity === 'error'
                    ? monacoRef.MarkerSeverity.Error
                    : e.severity === 'warning'
                      ? monacoRef.MarkerSeverity.Warning
                      : monacoRef.MarkerSeverity.Info,
              }));
            monacoRef.editor.setModelMarkers(model, 'opa-editor', markers);
          }
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [domain, value, onValidate, monacoRef]);

  return (
    <Editor
      language="rego"
      value={value}
      onMount={handleMount}
      onChange={(v) => onChange(v ?? '')}
      options={{
        minimap: { enabled: false },
        automaticLayout: true,
        fontSize: 14,
        tabSize: 2,
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        renderWhitespace: 'boundary',
        lineNumbers: 'on',
      }}
    />
  );
};
