/**
 * Diagnostics panel — displays L1/L2/L3 validation errors grouped by layer.
 * See design spec §8.2, §6.1.
 */

import React from 'react';
import type { DomainError } from '@develapp/opa-domain-contract';
import {
  List,
  ListItem,
  ListItemText,
  Chip,
  Box,
  Typography,
} from '@mui/material';

interface DiagnosticsPanelProps {
  errors: DomainError[];
  loading?: boolean;
}

const severityColor: Record<string, 'error' | 'default' | 'primary'> = {
  error: 'error',
  warning: 'default',
  info: 'primary',
};

const layerLabel: Record<string, string> = {
  'L1-schema': 'L1 · Schema Type',
  'L2-regal': 'L2 · Regal Lint',
  'L3-domain': 'L3 · Domain Guard',
};

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  errors,
  loading,
}) => {
  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Validating…
        </Typography>
      </Box>
    );
  }

  if (errors.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" style={{ color: '#4caf50' }}>
          ✓ No issues found
        </Typography>
      </Box>
    );
  }

  // Group errors by layer
  const grouped: Record<string, DomainError[]> = {};
  for (const err of errors) {
    if (!grouped[err.layer]) grouped[err.layer] = [];
    grouped[err.layer].push(err);
  }

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Diagnostics ({errors.length})
      </Typography>
      {Object.entries(grouped).map(([layer, layerErrors]) => (
        <Box key={layer} sx={{ mb: 1 }}>
          <Chip
            size="small"
            label={layerLabel[layer] ?? layer}
            color={
              layerErrors.some((e) => e.severity === 'error')
                ? 'error'
                : 'default'
            }
            style={{ marginBottom: 4 }}
          />
          <List dense>
            {layerErrors.map((err, idx) => (
              <ListItem key={idx} dense>
                <ListItemText
                  primary={err.message}
                  secondary={
                    err.range
                      ? `Line ${err.range.startLine}${
                          err.range.startColumn
                            ? `:${err.range.startColumn}`
                            : ''
                        }`
                      : undefined
                  }
                />
                <Chip
                  size="small"
                  color={severityColor[err.severity] ?? 'default'}
                  label={err.severity}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      ))}
    </Box>
  );
};
