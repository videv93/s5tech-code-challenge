import { Router } from 'express';
import { openApiDocument } from './openapi.js';

export const docsRoutes = Router();

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
