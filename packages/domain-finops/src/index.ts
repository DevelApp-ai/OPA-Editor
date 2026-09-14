/**
 * Public API for @develapp/opa-domain-finops.
 *
 * Exports the FinOps FOCUS cost-modeling DomainDescriptor and snippets.
 * See design spec §5.3.
 */

export { finopsCostModelDomain, initFinopsDomain } from './domain-guard';
export { finopsSnippets } from './snippets';

import { finopsSnippets } from './snippets';
import { finopsCostModelDomain } from './domain-guard';

/** Wire snippets into the domain descriptor. */
finopsCostModelDomain.snippets = finopsSnippets;

export default finopsCostModelDomain;
