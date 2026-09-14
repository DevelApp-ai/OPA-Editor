/**
 * Backstage frontend plugin registration.
 * See design spec §6.1.
 */

import {
  createFrontendPlugin,
  createApiRef,
  createApiFactory,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';
import { OpaEditorApiClient, opaEditorApiRef } from './api/OpaEditorApiClient';

export const opaEditorFrontendPlugin = createFrontendPlugin({
  id: 'opa-editor',
  apis: [
    createApiFactory({
      api: opaEditorApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new OpaEditorApiClient({ discoveryApi, fetchApi }),
    }),
  ],
  routes: {
    // The page is mounted at /opa-editor in the Backstage app.
    // In the new frontend system, routeRefs are defined in the app package.
    root: createRouteRef({
      id: 'opa-editor',
      path: '/opa-editor',
    }),
  },
});

// Helper for the new frontend system route ref
import { createRouteRef } from '@backstage/frontend-plugin-api';
