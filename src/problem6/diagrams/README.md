# Diagrams

Rendered from the ```mermaid blocks in [`../README.md`](../README.md) with
`@mermaid-js/mermaid-cli`, so a reviewer whose viewer does not render Mermaid can
open the SVGs directly. The Markdown source is the original; these are generated.

| File | Shows |
|---|---|
| `01-architecture.svg` | Component layout and the seven-step request path |
| `02-data-model.svg` | `users` ↔ `score_events` (append-only ledger) |
| `03-increment-flow.svg` | **Execution flow of a score increment**, including every rejection branch |
| `04-live-update-fanout.svg` | How a write on one instance reaches a client connected to another |

Regenerate:

```bash
npx @mermaid-js/mermaid-cli -i 03-increment-flow.mmd -o 03-increment-flow.svg
```
