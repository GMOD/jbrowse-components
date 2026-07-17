# Handoff: the "genome mark" shader abstraction (high value / high risk)

**Status:** proposed, **gated on a spike** (see below). Not started.
**Continues:** RFC-001 §5 (shader-pass library) and ADR-005 (Slang → WGSL/GLSL +
TS codegen). Read those first.

## One-line summary

Author the common instanced-quad **vertex skeleton** once in Slang so a new GPU
display becomes *a fragment shader + a field list* instead of a ~100-line
vertex+fragment pair copied from a sibling plugin.

## Why this is worth considering

Nearly every JBrowse track is the **same geom**: draw N instances of a quad,
positioned by `[genomicStart, genomicEnd] × [pixelY, height]` on the shared
genome viewport, colored by a packed `u32`, snapped to pixels. The commonality
across the 37 non-module `.slang` shaders:

| shared thing | # shaders |
| --- | --- |
| `import hpmath` | 30 |
| `import colorPack` | 26 |
| `quadLocal` (the 6-vert quad) | 25 |
| `bpToClipX` | 23 |
| vertex+fragment quad-instancing pair (`SV_Position`) | 23 |

The reusable **atoms** are already shared as Slang modules (`hpmath`,
`colorPack`). What is **not** shared is the *wiring* — each shader re-authors the
skeleton that calls `quadLocal` → `bpToClipX` on start/end → pixel-snap →
`unpackRGBA` → fills a `VsOut`. The payoff of factoring it:

- collapses ~23 near-duplicate vertex bodies
- a new display type is cheap to add (the RFC-001 §5 goal, taken further)
- the genuinely-varying part (edge-snap vs. center-snap vs. SDF circle) stays
  explicit per mark, because that is exactly what the mark supplies

## Why it is HIGH RISK (the specific unknowns)

The abstraction requires Slang generics/interfaces to parameterize a vertex
entry point over "a base instance struct + per-mark extra fields." The risks are
all in whether that survives the `slangc` reflection → `codegen.ts` → dual-target
pipeline **identically**:

1. **Attribute-location stability.** Can a generic append per-mark instance
   fields *after* a shared base and produce predictable, contiguous `ATTR`
   locations — identical on the WGSL and GLSL targets? A drifted attribute
   location is a **silent, backend-specific rendering bug**: exactly the failure
   class ADR-005 exists to eliminate. This is the make-or-break unknown.
2. **Reflection shape.** `codegen.ts` (`findVertexStruct`, `emitInterface`,
   `packInstances` emit) expects a **concrete flat struct** whose fields carry
   `ATTR` semantics. Does slangc reflection still emit that flat struct through a
   generic, or does it nest / mangle it? If it nests, codegen needs new
   struct-flattening logic (scope creep — decide deliberately, don't drift into
   it).
3. **Varying layout.** The shared `VsOut` must get consistent `@location`
   assignment across both targets or the fragment stage mismatches.
4. **Post-processor interaction.** `vulkanGlslToWebgl2.ts` is a set of regexes
   against pinned-slangc output; generics may produce name-mangled identifiers
   its rules don't anticipate.

## It also reopens a documented decision

RFC-001 §5b deliberately chose **"primitives, not a framework"** and §5c says
**"don't pre-design the point-shape family."** This scheme moves toward more
abstraction. Proceeding means the team consciously revisits that stance — it is
not a pure refactor.

## The gating spike (DO THIS FIRST — ~1 day, throwaway branch)

Do **not** design the interface or touch multiple shaders until this passes.

1. Author a `genomeQuad` Slang module in `packages/render-core/src/shaders/`
   exposing the vertex skeleton via a Slang `interface`/generic.
2. Rewrite **one** existing shader to consume it. Best first target: **`rect`**
   (`plugins/canvas/src/LinearBasicDisplay/passes/shaders/rect.slang`) — it is
   the canonical fill mark and its generated layout is well understood.
   Stretch target if rect works: **`arrow`** (center-snap + extra fields) to
   prove the "extra per-mark fields" path.
3. Run `pnpm gen:shaders`. **Diff the regenerated `rect.iface.generated.ts`
   (`FIELD_OFFSET_F32`, `GL_ATTRIBUTES`, `INSTANCE_STRIDE_*`) against the
   committed file.**
4. Confirm `naga` (WGSL) and `glslangValidator` (GLSL) both accept the output —
   both now run in CI, so a red CI is the signal.
5. Render `rect` in the app; the visual-regression screenshots must be
   pixel-identical.

### Pass / fail criteria

- **PASS** — generated layout is **byte-identical**, both validators clean,
  pixels identical. The mechanism is safe → design the interface for real and
  migrate shaders incrementally (per-shader, low-risk once proven).
- **PARTIAL** — layout differs but in an explainable, codegen-adaptable way →
  make an explicit decision about whether teaching `codegen.ts` to handle it is
  worth the added codegen surface.
- **FAIL** — attribute locations drift or the two backends disagree → **abandon
  the generic approach** and take the fallback below.

## Fallback if the spike fails (the safe consolation prize)

A **non-generic "skeleton by convention"**: a shared `genomeQuadVertex(...)`
helper *function* in a Slang module that each shader calls at the top of its own
`vs_main`, while still declaring its own concrete instance struct. Less
leverage (each shader keeps its struct + entry point), but captures ~60% of the
vertex-body dedup with **zero** layout risk and **zero** codegen changes,
because reflection still sees a plain concrete struct. This is the graceful
degradation and is worth doing even if the generic path dies.

## What NOT to do

- Don't build a fleet of marks up front. Migrate on demand.
- Don't fold point shapes into a runtime SDF-shape-uniform `PointPass` until
  3–4 point shapes actually exist (RFC-001 §5c).
- Don't modify `codegen.ts` struct handling unless the spike proves you must.

## File pointers

- **Codegen (pure transforms):**
  `packages/shader-tools/src/shader-codegen/codegen.ts`
  — `findVertexStruct` (~L122), `emitInterface`, `packInstances` emit (~L388).
- **Codegen driver:** `packages/shader-tools/src/build-shaders.ts`.
- **GLSL post-processor:** `packages/shader-tools/src/shader-codegen/vulkanGlslToWebgl2.ts`.
- **Shared Slang modules:** `packages/render-core/src/shaders/{hpmath,colorPack}.slang`.
- **Canonical concrete shader + its generated output:**
  `plugins/canvas/src/LinearBasicDisplay/passes/shaders/rect.slang`, and its
  generated `rect.generated.ts` / `rect.iface.generated.ts`.
- **Pass assembly:** `packages/render-core/src/slangPass.ts`,
  `plugins/canvas/src/LinearBasicDisplay/passes/index.ts`.
- **GL-attribute safety net (keep green):**
  `products/jbrowse-web/src/tests/glAttributeSync.test.ts` — parses generated
  GLSL and asserts every `GL_ATTRIBUTE` matches a shader input.
- **Prior decisions:** `agent-docs/reference/RFC-001-community-plugin-api.md` §5,
  `agent-docs/architecture-decision-records/adr-005-shader-codegen-slang.md`.

## Effort

Spike: ~1 day. If green, interface design + incremental migration of the ~23
quad shaders is multi-week but parallelizable per shader and low-risk once the
mechanism is proven.

## Related low-risk work already landed

- The shared `bpRangeX` uniform write is standardized on
  `writeBpRangeUniforms(f32, U.bpRangeX, clip, reversed)` across all five
  offset-poke genome renderers (`packages/render-core/src/blockClipUtils.ts`),
  with the two uniform-write patterns documented in
  `packages/render-core/CLAUDE.md`.
- `naga` (WGSL validation) now runs in CI, so the spike's validator check is
  automatic.
