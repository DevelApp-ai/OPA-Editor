/**
 * Domain picker — selects the active DomainDescriptor.
 * See design spec §6.1.
 */

import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@material-ui/core';
import type { DomainDescriptor } from '@develapp/opa-domain-contract';

interface DomainPickerProps {
  domains: DomainDescriptor[];
  selectedId: string | null;
  onSelect: (domainId: string) => void;
}

export const DomainPicker: React.FC<DomainPickerProps> = ({
  domains,
  selectedId,
  onSelect,
}) => {
  return (
    <Box mb={2}>
      <FormControl fullWidth variant="outlined" size="small">
        <InputLabel>Domain</InputLabel>
        <Select
          value={selectedId ?? ''}
          onChange={(e) => onSelect(e.target.value as string)}
          label="Domain"
        >
          {domains.map((d) => (
            <MenuItem key={d.id} value={d.id}>
              {d.title}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};
