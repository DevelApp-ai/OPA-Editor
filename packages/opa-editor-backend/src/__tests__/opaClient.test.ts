/**
 * Unit tests for OpaClient.
 * Mocks global fetch.
 */

describe('OpaClient', () => {
  let OpaClient: any;
  let mockFetch: jest.Mock;

  beforeEach(async () => {
    mockFetch = jest.fn();
    (global as any).fetch = mockFetch;
    OpaClient = (await import('../service/opaClient')).OpaClient;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('strips trailing slash from baseUrl', () => {
      const client = new OpaClient({ baseUrl: 'http://localhost:8181/' });
      expect((client as any).baseUrl).toBe('http://localhost:8181');
    });

    it('stores the token', () => {
      const client = new OpaClient({ baseUrl: 'http://localhost:8181', token: 'secret' });
      expect((client as any).token).toBe('secret');
    });
  });

  describe('publishPolicy', () => {
    it('sends PUT request to /v1/policies/<id> with Rego body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ revision: 'rev123' }),
      });

      const client = new OpaClient({ baseUrl: 'http://opa:8181', token: 'tok' });
      const result = await client.publishPolicy('my-policy', 'package test\nallow := true');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://opa:8181/v1/policies/my-policy',
        expect.objectContaining({
          method: 'PUT',
          body: 'package test\nallow := true',
        }),
      );
      expect(result.status).toBe('ok');
      expect(result.revision).toBe('rev123');
    });

    it('returns error when OPA responds with non-OK status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'bad request',
      });

      const client = new OpaClient({ baseUrl: 'http://opa:8181' });
      const result = await client.publishPolicy('my-policy', 'bad rego');

      expect(result.status).toBe('error');
      expect(result.message).toContain('400');
    });

    it('includes Authorization header when token is set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const client = new OpaClient({ baseUrl: 'http://opa:8181', token: 'mytoken' });
      await client.publishPolicy('p', 'package p');

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.headers['Authorization']).toBe('Bearer mytoken');
    });
  });

  describe('evaluate', () => {
    it('sends POST to /v1/query with query and input', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: [{ expressions: [{ value: true }] }] }),
      });

      const client = new OpaClient({ baseUrl: 'http://opa:8181' });
      const result = await client.evaluate('data.test.allow', { user: 'alice' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://opa:8181/v1/query',
        expect.objectContaining({
          method: 'POST',
        }),
      );
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.query).toBe('data.test.allow');
      expect(body.input).toEqual({ user: 'alice' });
      expect(result.result).toBeDefined();
    });

    it('returns error on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'internal error',
      });

      const client = new OpaClient({ baseUrl: 'http://opa:8181' });
      const result = await client.evaluate('data.test.allow', {});

      expect(result.error).toContain('500');
    });
  });

  describe('health', () => {
    it('returns true when OPA health endpoint responds OK', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const client = new OpaClient({ baseUrl: 'http://opa:8181' });
      const result = await client.health();
      expect(result).toBe(true);
    });

    it('returns false when fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('connection refused'));
      const client = new OpaClient({ baseUrl: 'http://opa:8181' });
      const result = await client.health();
      expect(result).toBe(false);
    });
  });
});
