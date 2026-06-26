# Paper abstract — superseded alternate framings

Archive of abstract framings not chosen. The current abstract lives in
`paper-abstract.md` (Draft A: architecture-as-the-point). These are kept only
as a record of alternate angles, in case one is promoted to the lead.

If any of these is revived, apply the same accuracy fixes already made to the
chosen draft: "GPU buffers **that persist across navigation**" (not "once"); the
fallback ladder phrased as "selects, **in order of preference**, WebGPU, WebGL2,
or a Canvas2D software fallback"; "multiple-genome alignment **(MAF)**".

---

## Alternate 1 — model-owned render lifecycle as the lead idea

Lifecycle framing (model-owned, autorun-driven, no manual invalidation) is
folded into the chosen Draft A. The distinguishing bits here are the standalone
title and the "couple rendering to the view layer" opening.

**Title:** Moving the render lifecycle off the view: a model-owned GPU rendering
architecture for JBrowse 2

> Web genome browsers commonly couple rendering to the view layer, redrawing in
> response to component updates. JBrowse 2 rendered all track types on the CPU
> with per-block HTML-canvas drawing, re-rendering on each zoom or pan. We
> describe a re-architecture (version 5.0) in which the render lifecycle is owned
> by the data model rather than the React view. Data is parsed in web workers,
> emitted in absolute genomic coordinates, and uploaded to GPU buffers once;
> reactive autoruns tied to the model's lifetime drive upload and draw, so the
> correct work re-runs when observable state changes, without manual
> invalidation. Navigation redraws from GPU-resident data, supporting continuous
> zooming and panning across track types including alignments, variants,
> coverage, multiple-genome alignment, Hi-C, and synteny. A hardware abstraction
> layer selects WebGPU, then WebGL2, then a Canvas2D software fallback; draw
> shaders are written in Slang and compiled to the WGSL and GLSL targets, with
> buffer layouts generated from shader reflection. End-user sessions and configs
> migrate automatically; the prior server-side renderer interface is removed,
> requiring custom-renderer plugins to be updated. We report the architecture
> and its application across an existing browser's track types.

---

## Alternate 2 — feasibility & cost of an in-place GPU migration

Distinct angle: the contribution is the in-place migration of an established
browser and its engineering trade-offs, rather than the architecture itself.

**Title:** Migrating an established genome browser to GPU rendering: architecture
and cost

> GPU-rendered genome visualization tools such as GenomeSpy and HiGlass were
> built for the GPU from the outset. We instead report converting an established,
> widely deployed browser, JBrowse 2, from CPU rendering to GPU rendering. The
> prior version rendered all track types on the CPU using per-block HTML-canvas
> drawing, re-rendering on each navigation event. In the re-architecture (version
> 5.0), data is parsed in web workers, emitted in absolute genomic coordinates,
> and uploaded to GPU buffers once; the render lifecycle is owned by the data
> model, and navigation redraws from the resident data. This supports continuous
> zooming and panning across track types including alignments, variants,
> coverage, multiple-genome alignment, Hi-C, and synteny. A hardware abstraction
> layer selects WebGPU, then WebGL2, then a Canvas2D software fallback, and draw
> shaders are written in Slang and compiled to the WGSL and GLSL targets, with
> buffer layouts generated from shader reflection. We describe the scope of such
> a migration: end-user sessions and configurations migrate automatically and
> remain compatible, whereas the server-side renderer interface was removed,
> requiring plugins with custom renderers to be rewritten. We report the
> architecture and the engineering trade-offs of an in-place migration.
