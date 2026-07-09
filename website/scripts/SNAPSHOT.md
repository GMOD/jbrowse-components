# `snapshot.ts` — minimal page snapshotter

A small, framework-agnostic tool to capture a web page to a **content-stable**
PNG: it only rewrites the output file when the rendered page actually changed
(diffed with ImageMagick `compare`), so re-running it in CI doesn't churn
committed images.

It's the reusable core of the larger JBrowse doc pipeline in
`generate-screenshots.ts`, with none of the JBrowse coupling — point it at any
URL. It imports only `image-pipeline.ts` (the diff gate + pngquant optimize) and
`annotations.ts` (the SVG callout overlay), both self-contained, so this file
can move into its own package unchanged.

## Requirements

- **puppeteer** (already a dependency here).
- A Chrome/Chromium. If puppeteer's bundled browser isn't installed, set
  `CHROME_PATH` (or `PUPPETEER_EXECUTABLE_PATH`) or pass `--chrome <path>`.
- **ImageMagick** (`compare`/`identify`) for the content-stable diff gate.
- **pngquant** (optional) for image optimization; skipped if absent.

## CLI

```bash
pnpm snapshot --url https://example.com --out shot.png

pnpm snapshot \
  --url http://localhost:3000 \
  --out home.png \
  --wait-selector "#app" \
  --width 1500 --height 800 --scale 2
```

| flag                               | meaning                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `--url <url>`                      | page to capture (required)                                               |
| `--out <file.png>`                 | output path (required)                                                   |
| `--wait-selector <css>`            | wait for this selector to be visible before capture                      |
| `--wait-text <text>`               | wait for this visible text before capture                                |
| `--width` / `--height` / `--scale` | viewport (default `1500`×`800` @`2`)                                     |
| `--settle <ms>`                    | extra settle before capture (default 250)                                |
| `--diff-threshold <f>`             | pixel-diff fraction below which the existing PNG is kept (default 0.005) |
| `--force`                          | overwrite even if unchanged                                              |
| `--headed`                         | run a visible browser                                                    |
| `--chrome <path>`                  | browser executable                                                       |

Exit status prints `new` / `updated` / `kept` per the content-stable result.

## Library

```ts
import { snapshot, snapshotAll } from './snapshot.ts'

// one page
await snapshot(
  { name: 'home', url: 'http://localhost:3000', waitForSelector: '#app' },
  { outDir: 'static/img' },
)

// many pages, pooled
await snapshotAll(
  [
    { name: 'home', url: 'http://localhost:3000/' },
    { name: 'about', url: 'http://localhost:3000/about', waitForText: 'About' },
  ],
  { outDir: 'static/img', concurrency: 4 },
)
```

Annotations (red arrows / boxes / text pills, optionally DOM-anchored) come from
`annotations.ts`:

```ts
await snapshot({
  name: 'annotated',
  url: 'http://localhost:3000',
  annotations: [
    { type: 'box', anchor: { text: 'Save' } }, // wraps the "Save" button
    { type: 'text', x: 200, y: 400, text: 'click here' },
    { type: 'arrow', from: { x: 100, y: 500 }, to: { x: 400, y: 300 } },
  ],
})
```
