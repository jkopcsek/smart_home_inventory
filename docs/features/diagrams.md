# Mermaid diagrams

## Intention

Free-form technical diagrams (wiring runs, network topology, logic flows) as
text — versionable, editable, no drawing tool needed. Diagrams can stand alone
or be anchored to an area or device.

## Design

- Only the **mermaid source text** is stored (`Diagram.source`); rendering
  happens client-side. No server-side rendering, no image exports.
- The mermaid bundle is large, so it is **lazy-loaded** on first render
  (`await import('mermaid')` → own chunk) and bundled from npm — no CDN, which
  matters under Ingress/offline. `securityLevel: 'strict'`; theme follows the
  app's light/dark mode and re-initializes on change.
- The live preview keeps the **last good SVG** visible while the source is
  mid-edit/invalid and shows the parse error inline; a render-generation
  counter prevents a stale async render from overwriting a newer one.
- Future option the connection model was designed for: auto-generating a
  mermaid graph from documented connections (see
  [connections.md](connections.md)).

## Code

- Model: `Diagram` in [schema.prisma](../../libs/prisma/prisma/schema.prisma)
- API: [diagrams.controller.ts](../../apps/backend/src/app/diagrams/diagrams.controller.ts) (`/api/diagrams`)
- Rendering: [mermaid-render.service.ts](../../apps/frontend/src/app/features/diagrams/mermaid-render.service.ts),
  [mermaid-view.component.ts](../../apps/frontend/src/app/features/diagrams/mermaid-view.component.ts)
- Editor page: [diagrams-page.component.ts](../../apps/frontend/src/app/features/diagrams/diagrams-page.component.ts)
