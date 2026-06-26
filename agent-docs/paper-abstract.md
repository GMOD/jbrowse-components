# JBrowse 2 GPU rendering paper — title & abstract drafts

Working drafts for the writeup of the WebGPU/WebGL2/Canvas2D rendering
re-architecture (ships as JBrowse 2 v5.0). Source material:
`~/agent-docs-backup/HIGHLIGHTS.md` and `~/agent-docs-backup/MERGE-SUMMARY.md`.

Register: dry/declarative, no salesmanship. Honest scope notes:

- End-user **sessions and configs migrate automatically** (`preProcessSnapshot`)
  and remain compatible.
- The **plugin renderer API was removed** (renderer registry, `CoreRender` RPC,
  server-side renderer classes) with no compatibility shim — plugins with custom
  renderers break. This is stated as scope, not hidden.
- **hi/lo float32** coordinate precision is **not** our contribution (GenomeSpy
  technique) — kept out of the abstract.
- GenomeSpy and HiGlass are GPU-rendered already; we cite them as precedent, not
  as a foil. Avoid the general-purpose-vs-purpose-built framing (too subtle, not
  quite fair).
- Slang's own framing: a shading language whose compiler targets multiple
  backends (WGSL, GLSL, SPIR-V, HLSL, MSL, ...). Prefer "written in Slang and
  compiled to the WGSL and GLSL targets" over the journalistic "cross-compiled."

Still missing across all drafts: a **measured result** (frame time, interaction
latency, max interactive dataset size). Add one to the closing sentence if
available.

---

## Draft A — architecture as the point (current preferred)

**Title:** A GPU rendering architecture for the JBrowse 2 genome browser

*(alt: Re-architecting JBrowse 2 for GPU rendering)*

> JBrowse 2 rendered all track types on the CPU using per-block HTML-canvas
> drawing, re-rendering on each zoom or pan. We describe a re-architecture
> (version 5.0) that moves rendering onto the GPU, following GPU-rendered genome
> visualization tools such as GenomeSpy and HiGlass. Data is parsed in web
> workers, emitted in absolute genomic coordinates, and uploaded to GPU buffers
> once; the render lifecycle is owned by the data model, and navigation redraws
> from the resident data rather than re-fetching or re-rendering. This supports
> continuous zooming and panning across the full range of track types, including
> alignments, variants, coverage, multiple-genome alignment, Hi-C, and synteny.
> A hardware abstraction layer selects WebGPU, then WebGL2, then a Canvas2D
> software fallback, so the application also runs without GPU support. To avoid
> maintaining separate shader implementations per backend, draw shaders are
> written in Slang and compiled to the WGSL and GLSL targets, with buffer
> layouts generated from shader reflection. End-user sessions and configurations
> are migrated automatically and remain compatible. The change replaces the
> previous server-side renderer interface, requiring plugins that defined custom
> renderers to be updated. We report the architecture, the shader toolchain, and
> the migration of an existing browser onto the GPU.

---

## Draft B — model-owned render lifecycle as the key design idea

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

## Draft C — feasibility & cost of an in-place GPU migration

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

---

## Title bank

- A GPU rendering architecture for the JBrowse 2 genome browser
- Re-architecting JBrowse 2 for GPU rendering
- Moving the render lifecycle off the view: a model-owned GPU rendering
  architecture for JBrowse 2
- Migrating an established genome browser to GPU rendering: architecture and cost
- GPU-accelerated rendering in JBrowse 2 across WebGPU, WebGL2, and Canvas2D
