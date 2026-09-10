import { Router } from 'express';
import helmet from 'helmet';
import { openApiDocument } from './openapi.js';

export const docsRoutes = Router();

const SCALAR_CDN = 'https://cdn.jsdelivr.net';

/**
 * The app-wide helmet policy is `script-src 'self'`, which is right for an API
 * that serves no scripts of its own — and which silently blocks the Scalar
 * bundle this page loads from a CDN. The symptom is the worst kind: `/docs`
 * returns 200 with a valid document and renders a blank page, so nothing in the
 * logs or a status check reveals it.
 *
 * This relaxes the policy for the docs route *only*. Every API response keeps
 * the strict default: the exception is scoped to the one page that needs it,
 * rather than widening the policy for endpoints that serve JSON.
 */
docsRoutes.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", "'unsafe-inline'", SCALAR_CDN],
        'style-src': ["'self'", "'unsafe-inline'", 'https:'],
        'font-src': ["'self'", 'data:', 'https:'],
        'img-src': ["'self'", 'data:', 'https:'],
        'connect-src': ["'self'", SCALAR_CDN],
        // Scalar spins up a worker from a blob URL for syntax highlighting.
        'worker-src': ["'self'", 'blob:'],
      },
    },
  }),
);

/** The machine-readable contract — point a client generator at this. */
docsRoutes.get('/openapi.json', (_req, res) => {
  res.status(200).json(openApiDocument);
});

/**
 * Human-readable reference. Rendered by Scalar from the CDN rather than bundling
 * a UI package: the spec above is the artefact that matters, and this keeps the
 * dependency footprint to the things that actually run in production.
 */
docsRoutes.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html>
  <head>
    <title>Swap Orders API — reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script id="api-reference" data-url="/docs/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`);
});
