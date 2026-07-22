# example-plugins

Worked plugins that back the developer guides. **Never published**, never
bundled into a product. They live here rather than in `plugins/` because
`plugins/*` is for shipping plugins and publishes to npm.

## These files are the developer guides

Code fences in the guides are **generated** from the files here via
`<!-- include: <path> -->` markers, so editing a file here edits the published
guide. After any change:

```bash
pnpm sync-doc-snippets     # rewrites the fences; --check runs in CI
```

`score-example` currently backs
[`plotting_features.md`](../website/docs/developer_guides/plotting_features.md)
(8 fences) and
[`creating_gpu_display.md`](../website/docs/developer_guides/creating_gpu_display.md)
(7 fences), which is every fence in both.

Consequences worth internalising:

- **A rename or signature change here rewrites two published guides.** That is
  the point (the guides used to teach an undefined type and a
  `createRenderingBackend` call with the wrong arity), but review the doc diff,
  not just the code diff.
- **`// #region <name>` / `// #endregion` markers are load-bearing.** A guide
  slices `rpcTypes.ts#region-data` and `scoreTypes.ts#render-state` through
  them; deleting one fails `sync-doc-snippets`. Whole-file includes strip the
  markers from the rendered output, so they cost nothing.
- Comments here are read by guide readers. Write them for that audience.

## Invariants

- **`"private": true`, but keep `publishConfig`.** pnpm applies `publishConfig`
  when _packing_, and the packed tarball is what `component_tests/plugin-vite`
  installs. Removing it changes what that test resolves; removing `private`
  publishes an example to npm.
- **It must stay packable.** `pnpm pack` runs `prepack` -> `build`; `pack.ts`
  hard-fails if a package declaring `files: ["esm"]` has no `esm/`.
- **Don't make the component test consume this as a workspace dependency.**
  Resolving through `workspace:^` reaches TypeScript source and silently drops
  the only coverage of the `exports` map, the `files` allowlist, and the esm
  build. That coverage is the entire reason this directory exists.
- Shaders: edit `.slang`, run `pnpm gen:shaders`, never hand-edit
  `*.generated.ts`.

## Testing

```bash
pnpm test example-plugins/score-example     # unit tests (jsdom)
```

The real guard is the external-consumer test, which is also what CI runs:

```bash
node scripts/pack.ts --pin-only             # re-pin from existing tarballs (fast)
cd component_tests/plugin-vite && pnpm install --no-frozen-lockfile && pnpm build && pnpm e2e
```

Omit `--pin-only` to rebuild every tarball from scratch (slow, tens of minutes).

## Adding another example

Four registrations, all easy to miss:

1. `pnpm-workspace.yaml` already globs `example-plugins/*`.
2. `scripts/pack.ts` already walks `example-plugins`.
3. `jest.config.js` needs the path in `testMatch` and `collectCoverageFrom`.
4. Point a guide at it with an `include:` marker, or it will drift like the
   hand-copied fences it replaces.
