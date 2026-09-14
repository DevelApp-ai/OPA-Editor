/**
 * Domain registry — loads DomainDescriptor packages for use in the frontend.
 * See design spec §6.1, §10.
 */

import type { DomainDescriptor } from '@develapp/opa-domain-contract';
import { finopsCostModelDomain } from '@develapp/opa-domain-finops';

/**
 * Registry of available domain descriptors.
 * In production, domains are loaded from app-config and dynamically imported.
 * For now, we hard-code the FinOps domain and allow additive registration.
 */
const registry = new Map<string, DomainDescriptor>();

/** Register a domain descriptor. */
export function registerDomain(domain: DomainDescriptor): void {
  registry.set(domain.id, domain);
}

/** Get a domain descriptor by ID. */
export function getDomain(domainId: string): DomainDescriptor | undefined {
  return registry.get(domainId);
}

/** List all registered domains. */
export function listDomains(): DomainDescriptor[] {
  return Array.from(registry.values());
}

// --- Auto-register built-in domains ---
// The FinOps FOCUS domain is bundled by default.
// Additional domains are registered at app composition time.
registerDomain(finopsCostModelDomain);
