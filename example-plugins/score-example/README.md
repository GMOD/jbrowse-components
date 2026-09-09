# @jbrowse/plugin-score-example

A worked, tested reference for two developer guides:

- [Plotting features in a custom display](https://jbrowse.org/jb2/docs/developer_guides/plotting_features/)
  (the display, its fetch chain and its mark list)
- [GPU displays](https://jbrowse.org/jb2/docs/developer_guides/creating_gpu_display/)
  (writing a shape of your own when no shared one fits)

`LinearScoreDisplay` attaches to any `FeatureTrack` and draws one box per
feature, height proportional to the feature's `score`. It declares its drawing
as a mark list over one plugin-local shape: `score.slang` compiled to WGSL +
GLSL, a uniform write, a Canvas2D painter that is also the SVG export, and a hit
test the hover reads. `createMarkBackend` turns the list into the WebGPU, WebGL2
and Canvas2D backends.

## Why it lives here and not in `plugins/`

It is never published and no product bundles it. It exists to keep the guide
code honest, which needs it built the way a reader's plugin is built.

So `component_tests/plugin-vite` installs it from a packed tarball with its own
vite and tsconfig, resolving `@jbrowse/*` through each package's `publishConfig`
exports map and built `esm/` rather than workspace-linked source. That runs on
every push, so a renamed subpath, a path missing from a package's `files`, or a
broken esm build fails before release. Nothing else in CI covers that.

It is also typechecked and unit-tested in-tree: the packer, the uniform write
through `MockHal`, the painter, the hit walk, and the shape's draw-against-hit
sweep.

## Layout

```
src/
  index.ts                              Plugin: registers the display + RPC
  ScoreRPC/                             worker: fetch features -> typed arrays
    GetScoreData.ts  buildScoreResult.ts  rpcTypes.ts
  LinearScoreDisplay/
    index.ts  configSchema.ts  model.ts
    scoreMark.ts                        the shape: pass, uniforms, painter, hit test
    scoreMarks.ts                       the mark list + ScoreRenderState
    findScoreHit.ts                     the display's hit walk
    renderSvg.tsx                       SVG export through the same painter
    components/ScoreDisplayComponent.tsx  <DisplayChrome> + <canvas>; createMarkBackend
    shaders/score.slang                 edit this, then run `pnpm gen:shaders`
```

Never hand-edit `shaders/*.generated.ts`; edit `score.slang` and run
`pnpm gen:shaders`.
