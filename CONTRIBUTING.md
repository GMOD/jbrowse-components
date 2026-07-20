# Contributing to JBrowse 2

Welcome, we are happy to receive contributions to JBrowse 2. This short guide
will help you get started.

## Quick Start

```bash
git clone https://github.com/GMOD/jbrowse-components
cd jbrowse-components
pnpm install
cd products/jbrowse-web
pnpm start
```

## Setup & Prerequisites

- **Package Manager**: [pnpm](https://pnpm.io/)
- **Windows**: Use `git clone -c core.symlinks=true`
- **Native Deps**: `node-canvas` (tests) requires system libs:
  - **macOS**: `brew install pkg-config cairo pango libpng jpeg giflib librsvg`
  - **Ubuntu**:
    `sudo apt install python3 make gcc libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`
  - If it fails, run `pnpm rebuild canvas`.

## Development

Run from root:

- **Lint**: `pnpm lint` (`--fix` to auto-fix)
- **Types**: `pnpm typecheck`
- **Format**: `pnpm format`
- **Test**: `pnpm test`

### Products

- **Web**: `cd products/jbrowse-web && pnpm start`
- **Desktop**: `cd products/jbrowse-desktop && pnpm dev` (starts the dev server
  and launches Electron in one command). To run the pieces separately, use
  `pnpm start` then `pnpm electron`.
- **Embedded component examples**:
  `cd products/jbrowse-react-linear-genome-view/examples-site && pnpm dev`

## Project Structure

- `packages/`: Core libraries.
- `plugins/`: Feature code (Alignments, Variants, etc.). Main dev area.
- `products/`: Apps (Web, Desktop, CLI).
- `website/`: Astro documentation site.

## Documentation

The website is an [Astro](https://astro.build/) site. Run it locally with:

```bash
cd website
pnpm dev
```
