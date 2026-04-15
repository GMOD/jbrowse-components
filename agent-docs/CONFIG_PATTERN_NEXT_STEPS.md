# Config Pattern: Next Steps

## Current

**Update variant color snapshots**  
Run `--update-snapshots` to regenerate golden images for green/purple variant
colors (replacing goldenrod).

**Verify renderer property promotion**  
Test tracks with custom `CanvasFeatureRenderer`, `SvgFeatureRenderer`,
`ArcRenderer`, `LollipopRenderer` settings (colors, heights). Ensure
`configuration.renderer.*` → display-level config promotion works.

**Add variant color e2e test**  
Browser test asserting non-goldenrod variant colors in new pipeline.

---

## Short-term

**Verify `geneGlyphMode` auto-switching**  
Default changed `'all'` → `'auto'`. Test zoom in/out on gene track; glyph style
should switch smoothly at zoom boundaries (triangles when zoomed out, full
glyphs when zoomed in).

---

## Medium-term

**Migrate HiC and dotplot to GPU**  
Replace `ServerSideRendererType` with GPU pipeline. Define `RenderState` +
`GpuXxxRenderer` + `Canvas2DXxxRenderer`, wire through `initDualBackend`, update
components with `useGpuRenderer` + `autorun`. See ARCHITECTURE.md.

---

## Long-term

**Replace JEXL with standard expressions**  
JEXL (config callbacks like `colorBy`) is non-standard. Consider Vega or
JavaScript subset for better IDE support.

**Track-level config shortcuts**  
Allow `{ "type": "FeatureTrack", "color": "green" }` instead of full `displays`
nesting. Requires spec layer (OTHER_IDEAS.md).
