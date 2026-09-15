/**
 * Express router for the OPA editor backend plugin.
 *
 * Endpoints:
 *   GET  /domains       — list available domains
 *   POST /validate      — run L1+L2+L3 validation
 *   POST /evaluate      — evaluate a Rego policy against input
 *   POST /publish       — validate, persist (GitOps), and push to OPA (REST)
 *
 * See design spec §8.1.
 */

import { Router } from 'express';
import type { DomainDescriptor } from '@develapp/opa-domain-contract';

import type { RegalBridge } from './regalBridge';
import { validatePolicy } from './validator';
import { OpaClient } from './opaClient';
import { GitOpsPolicyStore } from './policyStore';
import { createPolicyEntity } from '../catalog/policyEntity';

export interface RouterOptions {
  /** Registered domain descriptors (keyed by domainId) */
  domains: Map<string, DomainDescriptor>;
  /** Regal LSP bridge */
  regalBridge: RegalBridge;
  /** OPA REST client (direct REST mode) */
  opaClient: OpaClient;
  /** GitOps policy store */
  policyStore: GitOpsPolicyStore;
  /** Permissions authorize function */
  authorize: (
    permissions: Array<{ name: string; attributes: Record<string, unknown> }>,
    credentials: unknown,
  ) => Promise<Array<{ result: string }>>;
  /** Logger */
  logger: {
    info: (m: string) => void;
    error: (m: string) => void;
    warn: (m: string) => void;
  };
}

export function createRouter(options: RouterOptions): Router {
  const { domains, regalBridge, opaClient, policyStore, logger } = options;
  const router = Router();

  // --- GET /domains — list available domains ---
  router.get('/domains', async (_req, res) => {
    const list = Array.from(domains.values()).map((d) => ({
      id: d.id,
      title: d.title,
      inputSchemaUri: d.inputSchemaUri,
      requiredPackagePrefix: d.requiredPackagePrefix,
      requiredRules: d.requiredRules,
      schemaHash: d.schemaHash,
    }));
    res.json(list);
  });

  // --- POST /validate — run L1+L2+L3 validation ---
  router.post('/validate', async (req, res) => {
    const { domainId, rego } = req.body ?? {};

    if (!domainId || !rego) {
      res.status(400).json({
        errors: [
          {
            layer: 'L3-domain',
            severity: 'error',
            message: 'Missing domainId or rego in request body',
          },
        ],
      });
      return;
    }

    const domain = domains.get(domainId);
    if (!domain) {
      res.status(404).json({
        errors: [
          {
            layer: 'L3-domain',
            severity: 'error',
            message: `Unknown domain: ${domainId}`,
          },
        ],
      });
      return;
    }

    const result = await validatePolicy(
      { domainId, rego, domain },
      regalBridge,
    );

    res.json({
      valid: result.valid,
      errors: result.errors,
      schemaHash: domain.schemaHash,
    });
  });

  // --- POST /evaluate — evaluate a Rego policy against input ---
  router.post('/evaluate', async (req, res) => {
    const { domainId, rego, input } = req.body ?? {};

    if (!domainId || !rego) {
      res.status(400).json({
        error: 'Missing domainId or rego in request body',
      });
      return;
    }

    const domain = domains.get(domainId);
    if (!domain) {
      res.status(404).json({ error: `Unknown domain: ${domainId}` });
      return;
    }

    // Validate first
    const validationResult = await validatePolicy(
      { domainId, rego, domain },
      regalBridge,
    );
    if (!validationResult.valid) {
      res.status(422).json({
        error: 'Policy validation failed',
        errors: validationResult.errors,
      });
      return;
    }

    // Evaluate via OPA
    const result = await opaClient.evaluate(rego, input ?? {});
    if (result.error) {
      res.status(502).json({ error: result.error });
      return;
    }

    res.json({ result: result.result });
  });

  // --- POST /publish — validate, persist (GitOps), push to OPA (REST) ---
  router.post('/publish', async (req, res) => {
    const { domainId, rego, metadata } = req.body ?? {};

    if (!domainId || !rego) {
      res.status(400).json({
        error: 'Missing domainId or rego in request body',
      });
      return;
    }

    const domain = domains.get(domainId);
    if (!domain) {
      res.status(404).json({ error: `Unknown domain: ${domainId}` });
      return;
    }

    const policyId = metadata?.policyId ?? `policy-${Date.now()}`;
    const version = metadata?.version ?? '1.0.0';

    // 1. Run full validation pipeline
    const validationResult = await validatePolicy(
      { domainId, rego, domain },
      regalBridge,
    );
    if (!validationResult.valid) {
      logger.warn(`Publish rejected — validation failed for ${policyId}`);
      res.status(422).json({
        status: 'rejected',
        errors: validationResult.errors,
      });
      return;
    }

    // 2. Persist to Git (GitOps)
    let stored;
    try {
      stored = await policyStore.save(policyId, domainId, rego, version);
      logger.info(`Policy ${policyId} committed to Git: ${stored.revision}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`GitOps store failed: ${message}`);
      res.status(500).json({
        status: 'error',
        error: `Failed to persist policy: ${message}`,
      });
      return;
    }

    // 3. Push to OPA via direct REST
    let publishResult;
    try {
      publishResult = await opaClient.publishPolicy(policyId, rego);
      if (publishResult.status === 'error') {
        logger.error(`OPA publish failed: ${publishResult.message}`);
        res.status(502).json({
          status: 'error',
          error: publishResult.message,
        });
        return;
      }
      logger.info(
        `Policy ${policyId} pushed to OPA: revision ${publishResult.revision}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`OPA client error: ${message}`);
      res.status(502).json({
        status: 'error',
        error: `Failed to push to OPA: ${message}`,
      });
      return;
    }

    // 4. Create catalog entity
    const entity = createPolicyEntity({
      policyId,
      domainId,
      version,
      revision: stored.revision,
      description: metadata?.description,
      owner: metadata?.owner,
      system: metadata?.system,
    });

    res.json({
      status: 'published',
      revision: stored.revision,
      opaRevision: publishResult.revision,
      errors: [],
      entity,
    });
  });

  return router;
}
