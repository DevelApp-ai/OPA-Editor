/**
 * Backstage frontend plugin registration.
 * See design spec §6.1.
 */

import {
  createPlugin,
  createApiFactory,
  createRouteRef,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { OpaEditorApiClient, opaEditorApiRef } from './api/OpaEditorApiClient';

export const opaEditorRouteRef = createRouteRef({
  id: 'opa-editor',
});

export const opaEditorFrontendPlugin = createPlugin({
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
