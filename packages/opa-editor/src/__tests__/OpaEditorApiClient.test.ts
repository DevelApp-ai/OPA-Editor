/**
 * Unit tests for the OpaEditorApiClient.
 * Mocks fetch and discoveryApi.
 */

describe('OpaEditorApiClient', () => {
  let OpaEditorApiClient: any;
  let mockFetch: jest.Mock;
  let mockDiscoveryApi: any;

  beforeEach(async () => {
    mockFetch = jest.fn();
    mockDiscoveryApi = {
      getBaseUrl: jest.fn().mockResolvedValue('http://localhost:7007/api/opa-editor'),
    };

    OpaEditorApiClient = (await import('../api/OpaEditorApiClient.js')).OpaEditorApiClient;
  });

  function createClient() {
    return new OpaEditorApiClient({
      discoveryApi: mockDiscoveryApi,
      fetchApi: { fetch: mockFetch },
    });
  }

  describe('getDomains', () => {
    it('fetches domains from the backend', async () => {
      const domains = [
        { id: 'finops.costmodel', title: 'FinOps', requiredRules: ['allow'] },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => domains,
      });

      const client = createClient();
      const result = await client.getDomains();

      expect(mockDiscoveryApi.getBaseUrl).toHaveBeenCalledWith('opa-editor');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:7007/api/opa-editor/domains',
      );
      expect(result).toEqual(domains);
    });

    it('throws on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const client = createClient();
      await expect(client.getDomains()).rejects.toThrow('Failed to list domains');
    });
  });

  describe('validate', () => {
    it('POSTs to /validate with domainId and rego', async () => {
      const validationResult = { valid: true, errors: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validationResult,
      });

      const client = createClient();
      const result = await client.validate('finops.costmodel', 'package test');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:7007/api/opa-editor/validate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ domainId: 'finops.costmodel', rego: 'package test' }),
        }),
      );
      expect(result).toEqual(validationResult);
    });

    it('throws on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

      const client = createClient();
      await expect(client.validate('test', 'rego')).rejects.toThrow('Validate failed');
    });
  });

  describe('evaluate', () => {
    it('POSTs to /evaluate with domainId, rego, and input', async () => {
      const evalResult = { result: { allow: true } };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => evalResult,
      });

      const client = createClient();
      const result = await client.evaluate('test.domain', 'package test', { user: 'alice' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:7007/api/opa-editor/evaluate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            domainId: 'test.domain',
            rego: 'package test',
            input: { user: 'alice' },
          }),
        }),
      );
      expect(result).toEqual(evalResult);
    });
  });

  describe('publish', () => {
    it('POSTs to /publish with domainId, rego, and metadata', async () => {
      const publishResult = {
        status: 'published',
        revision: 'abc123',
        errors: [],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => publishResult,
      });

      const client = createClient();
      const result = await client.publish('test.domain', 'package test', {
        policyId: 'my-policy',
        version: '1.0.0',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:7007/api/opa-editor/publish',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            domainId: 'test.domain',
            rego: 'package test',
            metadata: { policyId: 'my-policy', version: '1.0.0' },
          }),
        }),
      );
      expect(result).toEqual(publishResult);
    });
  });
});
