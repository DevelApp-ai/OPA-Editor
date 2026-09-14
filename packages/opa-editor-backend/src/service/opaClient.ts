/**
 * OPA REST API client — pushes Rego policies to an OPA server via
 * `PUT /v1/policies/<id>` (direct REST mode).
 *
 * See design spec §7.4 — Distribution mode: Direct REST.
 * The OPA server is reached through the Backstage proxy plugin so
 * credentials stay server-side.
 */

export interface OpaClientOptions {
  /** Base URL of the OPA server (or the Backstage proxy endpoint) */
  baseUrl: string;
  /** Optional bearer token for authentication */
  token?: string;
}

export interface PublishResult {
  id: string;
  revision?: string;
  status: 'ok' | 'error';
  message?: string;
}

export class OpaClient {
  private baseUrl: string;
  private token?: string;

  constructor(options: OpaClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
  }

  /**
   * Push a Rego policy module to OPA via PUT /v1/policies/<id>.
   * The policy is activated immediately on the OPA server.
   */
  async publishPolicy(policyId: string, rego: string): Promise<PublishResult> {
    const url = `${this.baseUrl}/v1/policies/${encodeURIComponent(policyId)}`;
    const headers: Record<string, string> = {
      'Content-Type': 'text/plain',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const resp = await fetch(url, {
      method: 'PUT',
      headers,
      body: rego,
    });

    if (!resp.ok) {
      const body = await resp.text();
      return {
        id: policyId,
        status: 'error',
        message: `OPA responded ${resp.status}: ${body}`,
      };
    }

    const json = (await resp.json()) as { revision?: string };
    return {
      id: policyId,
      revision: json.revision,
      status: 'ok',
    };
  }

  /**
   * Evaluate a Rego query against input data.
   * Uses POST /v1/data/<path> with the input document.
   */
  async evaluate(
    rego: string,
    input: unknown,
    schema?: object,
  ): Promise<{ result?: unknown; error?: string }> {
    const url = `${this.baseUrl}/v1/query`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const body: Record<string, unknown> = {
      query: rego,
      input,
    };
    if (schema) {
      body.schema = schema;
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { error: `OPA responded ${resp.status}: ${text}` };
    }

    const json = (await resp.json()) as { result?: unknown };
    return { result: json.result };
  }

  /** Check if the OPA server is reachable. */
  async health(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/health`;
      const headers: Record<string, string> = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      const resp = await fetch(url, { headers });
      return resp.ok;
    } catch {
      return false;
    }
  }
}
