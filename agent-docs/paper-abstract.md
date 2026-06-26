# JBrowse 2 GPU rendering paper — title & abstract

Working draft for the writeup of the WebGPU/WebGL2/Canvas2D rendering
re-architecture (ships as JBrowse 2 v5.0). Source material:
`~/agent-docs-backup/HIGHLIGHTS.md` and `~/agent-docs-backup/MERGE-SUMMARY.md`.
Superseded alternate framings are archived in `paper-abstract-alternates.md`.

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

On results: the closing frames the payoff qualitatively (per-zoom reload →
redraw from GPU-resident data; smooth zooming; per-data-type level-of-detail)
rather than quoting a single benchmark number. The quantitative backing lives
in `~/src/jb2bench` (zoom time-to-content 0 ms vs 1–15 s on the prior CPU
renderer; 17–117 ms redraw frame; WebGL2 / Intel UHD 630 / zoom-in) and belongs
in the methods/results section with its caveats, not in the abstract.

Per-data-type **level-of-detail** is mentioned once in the closing and likely
deserves its own section in the body.

---

## Abstract

**Title:** A GPU rendering architecture for the JBrowse 2 genome browser

*(alts in the title bank below)*

> In previous versions of JBrowse 2, all track types were rendered using HTML5
> canvas drawing, re-rendering on each zoom or pan. We describe a re-architecture
> (version 5.0) that moves rendering onto the GPU, following GPU-rendered genome
> visualization tools such as GenomeSpy and HiGlass. Data is parsed in web
> workers, emitted in absolute genomic coordinates, and uploaded to GPU buffers
> that persist across navigation, so navigation redraws from GPU-resident data
> rather than re-fetching or re-rendering. A unified rendering engine applies
> across all track types, including alignments, variants, Hi-C, and synteny. A
> hardware abstraction layer selects, in order of preference, WebGPU, WebGL2, or
> an HTML5 canvas fallback. To avoid maintaining separate shader implementations
> per backend, shaders are written in Slang and compiled to the WGSL and GLSL
> targets, with TypeScript buffer-layout code generated from shader reflection.
> End-user sessions and configurations migrate automatically; the previous
> server-side renderer interface is removed, requiring plugins with custom
> renderers to be updated. The result is smooth zooming, with per-data-type
> level-of-detail rendering. We report the architecture, the shader toolchain,
> and the migration of an existing browser onto the GPU.

---

## Title bank

- A GPU rendering architecture for the JBrowse 2 genome browser *(current)*
- Re-architecting JBrowse 2 for GPU rendering
- GPU-accelerated rendering in JBrowse 2 across WebGPU, WebGL2, and Canvas2D
- Moving the render lifecycle off the view: a model-owned GPU rendering
  architecture for JBrowse 2 *(alternate-framing title — see alternates doc)*
- Migrating an established genome browser to GPU rendering: architecture and
  cost *(alternate-framing title — see alternates doc)*
