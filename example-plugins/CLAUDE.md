# example-plugins

Worked plugins backing the developer guides. Never published, never bundled.

**Guide code fences are generated from these files** via `<!-- include: -->`
markers, so editing a file here edits the published guide — run
`pnpm sync-doc-snippets` after, review the doc diff, and write comments for
guide readers. `// #region` markers are load-bearing.

- **`"private": true`, but keep `publishConfig`** — pnpm applies it when
  _packing_, and the packed tarball is what `component_tests/plugin-vite`
  installs.
- **Don't make that test consume this as a workspace dependency.** Resolving
  through `workspace:^` reaches TypeScript source and silently drops the only
  coverage of the `exports` map, the `files` allowlist, and the esm build —
  which is the entire reason this directory exists.

The real guard is the external-consumer test CI runs:

```bash
node scripts/pack.ts --pin-only   # omit to rebuild all tarballs (slow)
cd component_tests/plugin-vite && pnpm install --no-frozen-lockfile && pnpm build && pnpm e2e
```

A new example needs adding to `jest.config.js` (`testMatch`,
`collectCoverageFrom`) and pointing at from a guide's `include:` marker.
