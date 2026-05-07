# JBrowse 2 Website

The JBrowse 2 website ([jbrowse.org/jb2](http://jbrowse.org/jb2/)) is built with
[Docusaurus](https://docusaurus.io/).

## Development

```bash
pnpm install
pnpm start
```

## Commands

- **Build**: `pnpm build` (outputs to `build/`)
- **Deploy**: `pnpm deploy` (syncs to S3 bucket)
- **Screenshots**: See [SCREENSHOTS.md](SCREENSHOTS.md) for automated screenshot
  info.

## Technical Notes

- **Markdown**: Use standard Markdown (not MDX).
- **Sidebar**: `docs/read_sidebar.js` converts `sidebar.json`.
- **Formatting**: `docs/parser.js` handles header parsing and heading levels for
  the PDF TOC.
