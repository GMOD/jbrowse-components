# example-plugins

- **Guide code fences are generated from these files** through
  `<!-- include: -->` markers, so an edit here edits a published guide. Run
  `pnpm sync-doc-snippets`, review the doc diff, and write comments for guide
  readers. `// #region` markers are load-bearing.
- **`"private": true`, but keep `publishConfig`**: pnpm applies it when packing,
  and `component_tests/plugin-vite` installs the packed tarball.
- **Don't make that test consume this as a workspace dependency.** Resolving
  through `workspace:^` reaches TypeScript source and drops the only coverage of
  the `exports` map, the `files` allowlist and the esm build.
- A new example goes in `jest.config.js` (`testMatch`, `collectCoverageFrom`).
