/**
 * Backstage frontend plugin registration.
 * See design spec §6.1.
 */

import {
  createFrontendPlugin,
  createApiFactory,
  createRouteRef,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';
import { OpaEditorApiClient, opaEditorApiRef } from './api/OpaEditorApiClient';

export const opaEditorRouteRef = createRouteRef({
  id: 'opa-editor',
  path: '/opa-editor',
});

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
    root: opaEditorRouteRef,
  },
});
