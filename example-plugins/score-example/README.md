# @jbrowse/plugin-score-example

A worked, tested reference for two developer guides:

- [Plotting features in a custom display](https://jbrowse.org/jb2/docs/developer_guides/plotting_features/)
  (Canvas2D)
- [GPU displays](https://jbrowse.org/jb2/docs/developer_guides/creating_gpu_display/)
  (WebGPU/WebGL2 with a Canvas2D fallback)

`LinearScoreDisplay` attaches to any `FeatureTrack` and draws one box per
feature, height proportional to the feature's `score`. It carries both render
paths behind one model: a `.slang` shader compiled to WGSL + GLSL, a
`GpuScoreRenderer`, a `Canvas2DScoreRenderer`, and a pure `drawScoreBlocks`
shared with SVG export.

## Why it lives here and not in `plugins/`

It is never published and no product bundles it. It exists to keep the guide
code honest, which needs it built the way a reader's plugin is built.

So `component_tests/plugin-vite` installs it from a packed tarball with its own
vite and tsconfig, resolving `@jbrowse/*` through each package's `publishConfig`
exports map and built `esm/` rather than workspace-linked source. That runs on
every push, so a renamed subpath, a path missing from a package's `files`, or a
broken esm build fails before release. Nothing else in CI covers that.

It is also typechecked and unit-tested in-tree: the Canvas2D draw path directly,
the GPU packer and uniform writes through `MockHal`.

## Layout

```
src/
  index.ts                              Plugin: registers the display + RPC
  ScoreRPC/                             worker: fetch features -> typed arrays
    GetScoreData.ts  buildScoreResult.ts  rpcTypes.ts
  LinearScoreDisplay/
    index.ts  configSchema.ts  model.ts
    components/
      ScoreDisplayComponent.tsx         <DisplayChrome> + <canvas>
      ScoreRendererFactory.ts           createRenderingBackend dispatch
      GpuScoreRenderer.ts               extends GpuPerRegionRenderingBackend
      Canvas2DScoreRenderer.ts          extends Canvas2DPerRegionRenderingBackend
      drawScore.ts                      pure draw fn (also SVG export)
      scoreTypes.ts
      shaders/score.slang               edit this, then run `pnpm gen:shaders`
```

Never hand-edit `shaders/*.generated.ts`; edit `score.slang` and run
`pnpm gen:shaders`.
