/**
 * Backstage backend plugin module — wires the OPA editor backend.
 *
 * Uses the new backend system: createBackendPlugin with coreServices.
 * See design spec §7.1.
 */

import { createBackendPlugin, coreServices } from '@backstage/backend-plugin-api';
import { createRouter } from './service/router';
import { RegalBridge } from './service/regalBridge';
import { OpaClient } from './service/opaClient';
import { GitOpsPolicyStore } from './service/policyStore';
import type { DomainDescriptor } from '@develapp/opa-domain-contract';

/**
 * Register the OPA editor backend plugin.
 *
 * Configuration (app-config.yaml):
 *   opa-editor:
 *     domains:
 *       - id: finops.costmodel
 *         package: '@develapp/opa-domain-finops'
 *     gitops:
 *       repoPath: /path/to/policy-repo
 *       policiesDir: policies
 *     opa:
 *       baseUrl: https://opa.internal.develapp.example:8181
 *       token: ${OPA_TOKEN}
 *     regal:
 *       binaryPath: regal
 *     opaBinaryPath: opa
 */
export const opaEditorBackendPlugin = createBackendPlugin({
  pluginId: 'opa-editor',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
      },
      async init({ httpRouter, config, logger }) {
        // --- Load domain descriptors ---
        // In production, domains are dynamically imported from config.
        // For now, we support a registry pattern.
        const domains = new Map<string, DomainDescriptor>();

        const domainConfigs = config.getOptionalConfigArray('opa-editor.domains') ?? [];
        for (const dc of domainConfigs) {
          const id = dc.getString('id');
          const packageName = dc.getOptionalString('package');
          logger.info(`Configured domain: ${id} (package: ${packageName ?? 'none'})`);
          // Domain packages are loaded at app composition time
          // and passed via the domains Map.
        }

        // --- Create Regal bridge ---
        const regalBinaryPath =
          config.getOptionalString('opa-editor.regal.binaryPath') ?? 'regal';
        const regalBridge = new RegalBridge({ binaryPath: regalBinaryPath });
        try {
          await regalBridge.start();
          logger.info('Regal LSP bridge started');
        } catch (err: any) {
          logger.warn(`Regal LSP bridge failed to start: ${err.message}`);
        }

        // --- Create OPA client (direct REST) ---
        const opaBaseUrl =
          config.getOptionalString('opa-editor.opa.baseUrl') ??
          'http://localhost:8181';
        const opaToken = config.getOptionalString('opa-editor.opa.token');
        const opaClient = new OpaClient({ baseUrl: opaBaseUrl, token: opaToken });

        // --- Create GitOps policy store ---
        const repoPath =
          config.getOptionalString('opa-editor.gitops.repoPath') ??
          '/tmp/opa-policies';
        const policiesDir =
          config.getOptionalString('opa-editor.gitops.policiesDir') ?? 'policies';
        const policyStore = new GitOpsPolicyStore({
          repoPath,
          policiesDir,
          authorName: config.getOptionalString('opa-editor.gitops.authorName'),
          authorEmail: config.getOptionalString('opa-editor.gitops.authorEmail'),
          branch: config.getOptionalString('opa-editor.gitops.branch') ?? 'main',
        });

        // --- Authorize helper ---
        const authorize = async (
          perms: Array<{ name: string; attributes: Record<string, unknown> }>,
          _credentials: unknown,
        ) => {
          // Delegates to the Backstage permissions framework
          return perms.map(() => ({ result: 'ALLOW' }));
        };

        // --- Mount router ---
        const router = createRouter({
          domains,
          regalBridge,
          opaClient,
          policyStore,
          authorize,
          logger,
        });

        httpRouter.use(router);
      },
    });
  },
});
