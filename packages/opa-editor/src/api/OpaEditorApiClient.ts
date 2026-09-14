/**
 * API client for the OPA editor backend.
 * Uses Backstage's fetchApi and discoveryApi.
 * See design spec §6.4, §8.1.
 */

import { createApiRef } from '@backstage/core-plugin-api';
import type { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import type { DomainError, DomainValidationResult } from '@develapp/opa-domain-contract';

export const opaEditorApiRef = createApiRef<OpaEditorApi>({
  id: 'plugin.opa-editor.api',
});

export interface DomainSummary {
  id: string;
  title: string;
  inputSchemaUri: string;
  requiredPackagePrefix: string;
  requiredRules: string[];
  schemaHash?: string;
}

export interface PublishMetadata {
  policyId: string;
  version: string;
  description?: string;
  owner?: string;
  system?: string;
}

export interface PublishResponse {
  status: 'published' | 'rejected' | 'error';
  revision?: string;
  opaRevision?: string;
  errors: DomainError[];
  entity?: unknown;
}

export interface OpaEditorApi {
  getDomains(): Promise<DomainSummary[]>;
  validate(domainId: string, rego: string): Promise<DomainValidationResult>;
  evaluate(
    domainId: string,
    rego: string,
    input: unknown,
  ): Promise<{ result?: unknown; error?: string }>;
  publish(
    domainId: string,
    rego: string,
    metadata: PublishMetadata,
  ): Promise<PublishResponse>;
}

export class OpaEditorApiClient implements OpaEditorApi {
  private discoveryApi: DiscoveryApi;
  private fetchApi: FetchApi;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  private async baseUrl(): Promise<string> {
    return this.discoveryApi.getBaseUrl('opa-editor');
  }

  async getDomains(): Promise<DomainSummary[]> {
    const url = `${await this.baseUrl()}/domains`;
    const resp = await this.fetchApi.fetch(url);
    if (!resp.ok) throw new Error(`Failed to list domains: ${resp.status}`);
    return resp.json();
  }

  async validate(
    domainId: string,
    rego: string,
  ): Promise<DomainValidationResult> {
    const url = `${await this.baseUrl()}/validate`;
    const resp = await this.fetchApi.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domainId, rego }),
    });
    if (!resp.ok) throw new Error(`Validate failed: ${resp.status}`);
    return resp.json();
  }

  async evaluate(
    domainId: string,
    rego: string,
    input: unknown,
  ): Promise<{ result?: unknown; error?: string }> {
    const url = `${await this.baseUrl()}/evaluate`;
    const resp = await this.fetchApi.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domainId, rego, input }),
    });
    return resp.json();
  }

  async publish(
    domainId: string,
    rego: string,
    metadata: PublishMetadata,
  ): Promise<PublishResponse> {
    const url = `${await this.baseUrl()}/publish`;
    const resp = await this.fetchApi.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domainId, rego, metadata }),
    });
    return resp.json();
  }
}
