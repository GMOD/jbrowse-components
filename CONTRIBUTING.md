# Contributing to JBrowse 2

Welcome, we are happy to receive contributions to jbrowse 2. This short guide
will help you get started

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
- **Windows**: Use `git clone -c core.symlinks=true` (setting up symlinks on
  windowws is awkward this way, sorry. requires admin/Developer Mode on
  windows).
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
- **Desktop**: Run `pnpm start` then `pnpm electron` in
  `products/jbrowse-desktop`.
- **Storybook**:
  `cd products/jbrowse-react-linear-genome-view && pnpm storybook`

## Project Structure

- `packages/`: Core libraries.
- `plugins/`: Feature code (Alignments, Variants, etc.). Main dev area.
- `products/`: Apps (Web, Desktop, CLI).
- `website/`: Docusaurus site.

## Documentation

Run

```bash
cd website
pnpm install
pnpm start
```
