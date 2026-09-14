/**
 * Unit tests for the Express router.
 * Mocks all dependencies (domains, regalBridge, opaClient, policyStore).
 */

import request from 'supertest';
import express from 'express';

// We need to mock the imported modules
jest.mock('../service/validator');
jest.mock('../catalog/policyEntity');

import { createRouter } from '../service/router';
import { validatePolicy } from '../service/validator';
import { createPolicyEntity } from '../catalog/policyEntity';

const mockValidatePolicy = validatePolicy as jest.Mock;
const mockCreatePolicyEntity = createPolicyEntity as jest.Mock;

const validRego = [
  '# METADATA',
  '# schemas:',
  '#   - input: schema["test"]',
  'package test.domain',
  '',
  'default allow := false',
  'allow if { input.name == "ok" }',
].join('\n');

describe('createRouter', () => {
  let app: express.Application;
  let mockDomains: Map<string, any>;
  let mockRegalBridge: any;
  let mockOpaClient: any;
  let mockPolicyStore: any;
  let mockAuthorize: any;
  let mockLogger: any;

  beforeEach(async () => {
    mockDomains = new Map();
    mockDomains.set('test.domain', {
      id: 'test.domain',
      title: 'Test Domain',
      inputSchemaUri: 'schemas/test.json',
      requiredPackagePrefix: 'test.domain',
      requiredRules: ['allow'],
      schemaHash: 'abc123',
      validateDomain: jest.fn().mockReturnValue({ valid: true, errors: [] }),
    });

    mockRegalBridge = { lintSource: jest.fn().mockResolvedValue([]) };

    mockOpaClient = {
      publishPolicy: jest.fn().mockResolvedValue({
        id: 'test-policy',
        revision: 'rev1',
        status: 'ok',
      }),
      evaluate: jest.fn().mockResolvedValue({ result: { allow: true } }),
      health: jest.fn().mockResolvedValue(true),
    };

    mockPolicyStore = {
      save: jest.fn().mockResolvedValue({
        id: 'test-policy',
        path: 'policies/test-policy.rego',
        revision: 'abc123def456',
        domainId: 'test.domain',
        version: '1.0.0',
        committedAt: new Date().toISOString(),
      }),
    };

    mockAuthorize = jest.fn().mockResolvedValue([{ result: 'ALLOW' }]);
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    // Mock validatePolicy
    mockValidatePolicy.mockResolvedValue({
      valid: true,
      errors: [],
      layers: {
        L1: { passed: true, errors: [] },
        L2: { passed: true, errors: [] },
        L3: { passed: true, errors: [] },
      },
    });

    // Mock createPolicyEntity
    mockCreatePolicyEntity.mockReturnValue({
      apiVersion: 'backstage.io/v1beta1',
      kind: 'Resource',
      metadata: { name: 'test-policy', tags: ['opa', 'rego'] },
      spec: {
        type: 'opa-rego',
        domainId: 'test.domain',
        policyId: 'test-policy',
      },
    });

    const router = createRouter({
      domains: mockDomains,
      regalBridge: mockRegalBridge,
      opaClient: mockOpaClient,
      policyStore: mockPolicyStore,
      authorize: mockAuthorize,
      logger: mockLogger,
    });

    app = express();
    app.use(express.json());
    app.use('/', router);
  });

  describe('GET /domains', () => {
    it('returns a list of registered domains', async () => {
      const res = await request(app).get('/domains');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe('test.domain');
      expect(res.body[0].title).toBe('Test Domain');
    });
  });

  describe('POST /validate', () => {
    it('validates a Rego policy and returns result', async () => {
      const res = await request(app)
        .post('/validate')
        .send({ domainId: 'test.domain', rego: validRego });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.errors).toEqual([]);
    });

    it('returns 400 when domainId is missing', async () => {
      const res = await request(app)
        .post('/validate')
        .send({ rego: validRego });

      expect(res.status).toBe(400);
      expect(res.body.errors[0].message).toContain('Missing');
    });

    it('returns 400 when rego is missing', async () => {
      const res = await request(app)
        .post('/validate')
        .send({ domainId: 'test.domain' });

      expect(res.status).toBe(400);
    });

    it('returns 404 for unknown domain', async () => {
      const res = await request(app)
        .post('/validate')
        .send({ domainId: 'unknown.domain', rego: validRego });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /evaluate', () => {
    it('evaluates a valid policy against input', async () => {
      const res = await request(app)
        .post('/evaluate')
        .send({
          domainId: 'test.domain',
          rego: validRego,
          input: { name: 'ok' },
        });

      expect(res.status).toBe(200);
      expect(res.body.result).toBeDefined();
    });

    it('returns 422 when validation fails', async () => {
      mockValidatePolicy.mockResolvedValueOnce({
        valid: false,
        errors: [{ layer: 'L3-domain', severity: 'error', message: 'bad' }],
        layers: {
          L1: { passed: true, errors: [] },
          L2: { passed: true, errors: [] },
          L3: {
            passed: false,
            errors: [{ severity: 'error', message: 'bad' }],
          },
        },
      });

      const res = await request(app)
        .post('/evaluate')
        .send({ domainId: 'test.domain', rego: 'bad rego', input: {} });

      expect(res.status).toBe(422);
    });

    it('returns 502 when OPA evaluation fails', async () => {
      mockOpaClient.evaluate.mockResolvedValueOnce({ error: 'OPA error' });

      const res = await request(app)
        .post('/evaluate')
        .send({ domainId: 'test.domain', rego: validRego, input: {} });

      expect(res.status).toBe(502);
    });
  });

  describe('POST /publish', () => {
    it('publishes a valid policy', async () => {
      const res = await request(app)
        .post('/publish')
        .send({
          domainId: 'test.domain',
          rego: validRego,
          metadata: { policyId: 'test-policy', version: '1.0.0' },
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('published');
      expect(res.body.revision).toBeDefined();
      expect(mockPolicyStore.save).toHaveBeenCalled();
      expect(mockOpaClient.publishPolicy).toHaveBeenCalledWith(
        'test-policy',
        validRego,
      );
    });

    it('returns 422 when validation fails', async () => {
      mockValidatePolicy.mockResolvedValueOnce({
        valid: false,
        errors: [{ layer: 'L3-domain', severity: 'error', message: 'bad' }],
        layers: {
          L1: { passed: true, errors: [] },
          L2: { passed: true, errors: [] },
          L3: {
            passed: false,
            errors: [{ severity: 'error', message: 'bad' }],
          },
        },
      });

      const res = await request(app)
        .post('/publish')
        .send({ domainId: 'test.domain', rego: 'bad', metadata: {} });

      expect(res.status).toBe(422);
      expect(res.body.status).toBe('rejected');
    });

    it('returns 500 when GitOps store fails', async () => {
      mockPolicyStore.save.mockRejectedValueOnce(new Error('git error'));

      const res = await request(app)
        .post('/publish')
        .send({
          domainId: 'test.domain',
          rego: validRego,
          metadata: { policyId: 'test-policy', version: '1.0.0' },
        });

      expect(res.status).toBe(500);
    });

    it('returns 502 when OPA publish fails', async () => {
      mockOpaClient.publishPolicy.mockResolvedValueOnce({
        id: 'test-policy',
        status: 'error',
        message: 'OPA rejected',
      });

      const res = await request(app)
        .post('/publish')
        .send({
          domainId: 'test.domain',
          rego: validRego,
          metadata: { policyId: 'test-policy', version: '1.0.0' },
        });

      expect(res.status).toBe(502);
    });
  });
});
