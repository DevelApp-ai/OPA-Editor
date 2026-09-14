/**
 * OPA editor page — the main editor surface.
 *
 * Layout:
 *   ┌─────────────────────────────────────────┐
 *   │ DomainPicker                             │
 *   │ ┌───────────────────────┐ ┌────────────┐  │
 *   │ │ RegoEditor (Monaco)    │ │ Diagnostics│  │
 *   │ │                        │ │   Panel    │  │
 *   │ └───────────────────────┘ └────────────┘  │
 *   │ [Validate]  [Evaluate]  [Publish]         │
 *   └─────────────────────────────────────────┘
 *
 * See design spec §6.
 */

import React, { useState, useCallback } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Button, Grid, Box, CircularProgress } from '@mui/material';

import { opaEditorApiRef, type PublishMetadata } from '../api/OpaEditorApiClient';
import { listDomains } from '../api/domainRegistry';
import type { DomainDescriptor, DomainError } from '@develapp/opa-domain-contract';
import { DomainPicker } from './DomainPicker';
import { RegoEditor } from './RegoEditor';
import { DiagnosticsPanel } from './DiagnosticsPanel';

const DEFAULT_REGO = `# Start writing your Rego policy here.
# Select a domain above to get schema-driven completions.
#
# METADATA
# schemas:
#   - input: schema["finops-focus"]
package finops.costmodel.template

default allow := true
default deny := false
default report := {}

deny if {
  input.EffectiveCost > 10000
  input.ServiceName == "AWS EC2"
}

allow if { not deny }

report[msg] if {
  input.EffectiveCost > 10000
  msg := sprintf("expensive: %v", [input.EffectiveCost])
}
`;

export const OpaEditorPage: React.FC = () => {
  const api = useApi(opaEditorApiRef);
  const domains: DomainDescriptor[] = listDomains();
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(
    domains[0]?.id ?? null,
  );
  const [rego, setRego] = useState(DEFAULT_REGO);
  const [liveErrors, setLiveErrors] = useState<DomainError[]>([]);
  const [serverErrors, setServerErrors] = useState<DomainError[]>([]);
  const [validating, setValidating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);

  const selectedDomain = domains.find((d) => d.id === selectedDomainId) ?? null;

  const handleValidate = useCallback(
    async (errors: DomainError[]) => {
      setLiveErrors(errors);
    },
    [],
  );

  const handleServerValidate = useCallback(async () => {
    if (!selectedDomainId || !rego) return;
    setValidating(true);
    try {
      const result = await api.validate(selectedDomainId, rego);
      setServerErrors(result.errors);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setServerErrors([
        {
          layer: 'L3-domain',
          severity: 'error',
          message: `Backend validation failed: ${message}`,
        },
      ]);
    } finally {
      setValidating(false);
    }
  }, [api, selectedDomainId, rego]);

  const handlePublish = useCallback(async () => {
    if (!selectedDomainId || !rego) return;
    setPublishing(true);
    setPublishResult(null);
    try {
      const metadata: PublishMetadata = {
        policyId: `policy-${selectedDomainId.replace(/\./g, '-')}-${Date.now()}`,
        version: '1.0.0',
        description: `OPA Rego policy for ${selectedDomain?.title}`,
      };
      const result = await api.publish(selectedDomainId, rego, metadata);
      if (result.status === 'published') {
        setPublishResult(`✓ Published — revision ${result.revision}`);
      } else {
        setPublishResult(`✗ Rejected — ${result.errors.length} errors`);
        setServerErrors(result.errors);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPublishResult(`✗ Error: ${message}`);
    } finally {
      setPublishing(false);
    }
  }, [api, selectedDomainId, rego, selectedDomain]);

  const allErrors = [...liveErrors, ...serverErrors];

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={2}>
        {/* Domain picker */}
        <Grid item xs={12}>
          <DomainPicker
            domains={domains}
            selectedId={selectedDomainId}
            onSelect={setSelectedDomainId}
          />
        </Grid>

        {/* Editor + diagnostics */}
        <Grid item xs={8}>
          <Box style={{ height: 500, border: '1px solid #e0e0e0' }}>
            <RegoEditor
              domain={selectedDomain}
              value={rego}
              onChange={setRego}
              onValidate={handleValidate}
            />
          </Box>
        </Grid>

        <Grid item xs={4}>
          <Box style={{ height: 500, overflow: 'auto' }}>
            <DiagnosticsPanel
              errors={allErrors}
              loading={validating}
            />
          </Box>
        </Grid>

        {/* Action buttons */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              variant="outlined"
              color="primary"
              onClick={handleServerValidate}
              disabled={validating || !selectedDomainId}
            >
              {validating ? <CircularProgress size={20} /> : 'Validate'}
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handlePublish}
              disabled={publishing || !selectedDomainId}
            >
              {publishing ? <CircularProgress size={20} /> : 'Publish'}
            </Button>
            {publishResult && (
              <Box sx={{ ml: 2 }}>
                <span>{publishResult}</span>
              </Box>
            )}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};
