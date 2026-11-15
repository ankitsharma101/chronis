import { Router, Request, Response } from 'express';

export function createDocsRouter(): Router {
  const router = Router();

  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'Chronis Privacy-Aware Memory Timeline API',
      version: '1.0.0',
      description: 'TypeScript backend API for managing personal memory events with category-level privacy controls and immutable audit logging.'
    },
    paths: {
      '/events': {
        get: {
          summary: 'List memory events',
          description: 'Retrieve chronological events. Automatically excludes categories disabled by privacy controls.'
        },
        post: {
          summary: 'Create memory event',
          description: 'Create a new event in the user timeline.'
        }
      },
      '/events/{id}': {
        get: {
          summary: 'Get event by ID',
          description: 'Retrieve a single event. Enforces privacy permissions: returns 403 Forbidden if category is OFF.'
        },
        delete: {
          summary: 'Delete event by ID'
        }
      },
      '/permissions': {
        get: { summary: 'Get privacy permissions' },
        put: { summary: 'Update privacy permissions' }
      },
      '/audit-log': {
        get: { summary: 'Get immutable audit logs' }
      }
    }
  };

  router.get('/openapi.json', (_req: Request, res: Response) => {
    res.status(200).json(openApiSpec);
  });

  router.get('/docs', (_req: Request, res: Response) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Chronis API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⏳</text></svg>">
  <style>
    body { margin: 0; background: #fafafa; font-family: sans-serif; }
    .topbar { display: none; }
    .swagger-ui .info { margin: 25px 0; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        deepLinking: true
      });
    };
  </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  });

  return router;
}
