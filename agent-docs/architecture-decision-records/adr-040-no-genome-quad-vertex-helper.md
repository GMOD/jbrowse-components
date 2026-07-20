# ADR-040: No shared genome-quad vertex helper; hpmath atoms are the right granularity

## Status

Accepted (2026-07). Continues [ADR-005](adr-005-shader-codegen-slang.md) (Slang
codegen) and RFC-001 §5b ("primitives, not a framework"). This ADR is the single
decision of record for **both** shapes the idea can take: the plain composition
helper (option 2 below) and the higher-risk generic vertex skeleton (option 1).
Neither is being built today. The generic skeleton's spike-and-migration
mechanics — previously a standalone handoff doc — are folded into the appendix
here so a future consumer-driven effort can pick them up without re-deriving.

## Context

Nearly every GPU track draws the same geometry: N instanced quads positioned by
`[genomicStart, genomicEnd] x [pixelY, height]`, snapped to pixels, colored by a
packed `u32`. That commonality keeps inviting a shared vertex helper. Two shapes
were considered:

1. A generic vertex **skeleton** parameterized over a per-mark instance struct
   (the high-value/high-risk version; mechanics in the appendix).
2. A plain **composition helper** in the hpmath tradition, e.g. a
   `genomeQuad` module exposing `genomeSpanX(bpStart, bpEnd, bpRangeX, zero,
   canvasW, minWidthPx) -> float2` that composes the existing atoms
   (`snapToPixelX(hpToClipX(...))` twice, then `extendToMinWidthX`).

This ADR is about option 2, evaluated purely on the integrity of the core
codebase as it stands today (the third-party-plugin ergonomics argument is
explicitly out of scope and, if it ever matters, is a different justification).

### What is already shared, and at what granularity

The genuinely reusable, drift-prone **atoms** already live in
`packages/render-core/src/shaders/hpmath.slang` and take **primitives, not a
`Uniforms` struct**: `hpToClipX`, `snapToPixelX`, `extendToMinWidthX`,
`yPxToClipY`, `quadLocal`. `pointGlyph.slang` is the precedent for a shared
*shape* module in the same style (disc SDF math, two real consumers, a
documented "must match" drift hazard).

### Why the composition helper does not clear the bar

Counting actual consumers of the proposed composition:

- **`extendToMinWidthX`** (the one atom with a real cross-shader min-width
  invariant that could drift) is **already shared by four shaders across three
  plugins**: `rect`, `multiRow`, `maf`, `wiggle`. That win is banked.
- **`snapToPixelX(hpToClipX(...))`** appears in only `rect` and `mismatch`, and
  `mismatch` **diverges on purpose** (`max(sx1 + 2/canvasW, snapToPixelX(clip2))`,
  a different floor) and flips downstream, so it cannot consume the helper
  regardless.
- The full `genomeSpanX` composition therefore has exactly **one** consumer:
  `rect`.

The other three `extendToMinWidthX` users derive their clip-X differently
(linear scale, already-snapped, etc.) and call the atom directly, which is
correct. They could not use `genomeSpanX`.

## Decision

**Do not extract a `genomeQuad` / `genomeSpanX` vertex-composition helper**, and
**do not run the generic vertex-skeleton spike** either — at least for now.
Keep the reusable atoms shared in `hpmath` and let each mark compose them inline
with its own variations (min-width value, whether to snap, direction, flip
stage). The varying part stays explicit per mark, which is exactly RFC-001 §5b's
stance.

### The generic skeleton (option 1), specifically

The higher-leverage generic version is not being pursued now. It is not a "run
the 1-day spike and see" — a green spike only unlocks a multi-week migration
whose payoff (cheap new display types, third-party-plugin ergonomics) has **no
current demand**, and a red spike leaves you falling back to option 2, which
this ADR already rejects as single-consumer. So the spike's expected value today
is low on both branches. It also carries the make-or-break unknown (attribute-
location stability across the WGSL and GLSL targets) plus a prerequisite
strand-flip reconciliation, neither cheap. Leave it gated; the appendix keeps the
mechanics so a future consumer-driven pull can pick it up without re-deriving.

### Why not, concretely

- A new `render-core` module and public function serving **one** call site is
  premature abstraction. It banks roughly zero dedup while adding an indirection
  and an import.
- It would move three lines of readable, well-commented composition out of
  `rect.slang` into a helper a reader must jump files to understand, against the
  "no one-line helpers / complexity-not-LOC" grain.
- The atom that *could* drift (`extendToMinWidthX`) is already the shared thing,
  so the anti-drift value the helper would nominally add is already captured a
  level down.

### How this differs from `pointGlyph` (the precedent that did earn it)

`pointGlyph` had **two** real consumers, **non-obvious math** (disc SDF, AA-pad
thresholds), and a **documented drift hazard** between former copies.
`genomeSpanX` has one consumer, trivial composition, and no live drift hazard.
The precedent argues against it, not for it.

## Consequences

- Shaders keep composing hpmath atoms inline. A reviewer who sees the same
  `snapToPixelX` / `extendToMinWidthX` sequence in `rect` and reaches for a
  "dedupe" should read this ADR first: the sequence is shared where it matters
  (the atoms) and the composition is single-consumer.
- The reverse-strand flip-model divergence between canvas (upstream, negated
  `bpRangeX`) and alignments (downstream, `flipX`) is untouched and remains
  correct as-is. See the flip-model memory and the appendix below. Do not naively
  share alignments' `flippedQuadPos` into canvas (double-flip bug).
- This decision would be revisited only on a real **multi-consumer pull** — the
  third-party-plugin ergonomics case becoming concrete (a different argument,
  weighed on its own merits), or 3–4 genuinely new quad-based display types
  landing close enough together that the migration pays for itself. At that
  point the gated spike in the appendix is the right de-risking first move, and
  the strand-flip reconciliation is its own visually-verified prerequisite step
  — not folded into the spike. Neither trigger is a win for the core codebase
  today.

## Appendix: generic-skeleton mechanics (only if a multi-consumer pull appears)

Retained from the former handoff doc. This is *how* to attempt the generic
skeleton if the revisit trigger above ever fires — not an endorsement to run it.

### The idea

Author the common instanced-quad **vertex skeleton** once in Slang (a
`genomeQuad` module in `packages/render-core/src/shaders/`, exposed via a Slang
`interface`/generic) so a new GPU display becomes *a fragment shader + a field
list* instead of a ~100-line vertex+fragment pair copied from a sibling plugin.
Across the ~37 non-module `.slang` shaders, 23 re-author the same skeleton:
`quadLocal` → `bpToClipX` on start/end → pixel-snap → `unpackRGBA` → fill a
`VsOut`. The atoms (`hpmath`, `colorPack`) are already shared; only the wiring is
duplicated.

### The make-or-break unknowns (all in the slangc → codegen → dual-target path)

1. **Attribute-location stability** — can a generic append per-mark instance
   fields *after* a shared base and produce predictable, contiguous, identical
   `ATTR` locations on **both** the WGSL and GLSL targets? Drift here is a
   silent, backend-specific rendering bug — the exact failure class ADR-005
   exists to eliminate. This is the decisive question.
2. **Reflection shape** — `codegen.ts` (`findVertexStruct`, `emitInterface`,
   `packInstances` emit) expects a concrete flat struct whose fields carry `ATTR`
   semantics. Does slangc reflection still emit that flat struct through a
   generic, or nest/mangle it (→ new struct-flattening logic, scope creep)?
3. **Varying layout** — the shared `VsOut` must get consistent `@location`
   across both targets or the fragment stage mismatches.
4. **Post-processor** — `vulkanGlslToWebgl2.ts` is regexes against pinned-slangc
   output; generics may produce name-mangled identifiers its rules don't expect.

### Prerequisite: reconcile the strand-flip model first

The two donor plugins flip reversed strands at different stages, and the skeleton
must standardize on one because the flip site is baked into where `SV_Position`
is assembled:

- **canvas** (`featureGlyphUniforms.slang`) flips **upstream**: `blockClipUtils.ts`
  negates the `bpRangeX` length component for reversed blocks, so positions come
  out already flipped; its `flipX` is used only on `inst.direction`, never on
  position.
- **alignments** (`alignmentsUniforms.slang`) flips **downstream**: computes
  forward clip-X, then applies `flipX` to the assembled position. This keeps
  per-glyph geometry authored in forward orientation (`start < end`) — mismatch's
  2px floor, insertion serifs, clip-bar widths, pixel-snap — trivially correct.

Both call the same `hpToClipX` core; the only difference is negate-upstream vs.
flip-downstream. Target the **upstream** (negated-`bpRange`) model when forced to
choose — it removes the per-vertex `flipX` — but budget for making alignments'
glyph geometry reversal-aware first (visually verified). Do **not** naively share
alignments' `flippedQuadPos` into canvas: canvas already applied the flip, so a
second `flipX` double-flips reversed blocks (silent correctness bug).

### The gating spike (~1 day, throwaway branch — do this before touching N shaders)

1. Author the `genomeQuad` Slang module exposing the skeleton via an
   interface/generic.
2. Rewrite **one** shader to consume it. Best first target: **`rect`**
   (`plugins/canvas/src/LinearBasicDisplay/passes/shaders/rect.slang`). Stretch:
   **`arrow`** (center-snap + extra fields) to prove the extra-per-mark-fields
   path.
3. Run `pnpm gen:shaders`; **diff regenerated `rect.iface.generated.ts`
   (`FIELD_OFFSET_F32`, `GL_ATTRIBUTES`, `INSTANCE_STRIDE_*`) against the
   committed file.**
4. Confirm `naga` (WGSL) and `glslangValidator` (GLSL) both accept the output —
   both run in CI, so red CI is the signal.
5. Render `rect` in the app; visual-regression screenshots must be pixel-identical.

**PASS** (byte-identical layout, both validators clean, pixels identical) → the
mechanism is safe; design the interface and migrate shaders incrementally.
**PARTIAL** (explainable, codegen-adaptable drift) → make an explicit call on
whether teaching `codegen.ts` to handle it is worth the added surface.
**FAIL** (attribute locations drift or backends disagree) → abandon the generic
approach. There is no non-generic fallback worth building — this ADR already
rejected the composition helper as single-consumer.

### File pointers

- Codegen: `packages/shader-tools/src/shader-codegen/codegen.ts`
  (`findVertexStruct`, `emitInterface`, `packInstances` emit); driver
  `build-shaders.ts`; GLSL post-proc `vulkanGlslToWebgl2.ts`.
- Shared Slang modules: `packages/render-core/src/shaders/{hpmath,colorPack}.slang`.
- Canonical concrete shader + generated output:
  `plugins/canvas/src/LinearBasicDisplay/passes/shaders/rect.slang` and its
  `rect.generated.ts` / `rect.iface.generated.ts`.
- Pass assembly: `packages/render-core/src/slangPass.ts`,
  `plugins/canvas/src/LinearBasicDisplay/passes/index.ts`.
- GL-attribute safety net (keep green):
  `products/jbrowse-web/src/tests/glAttributeSync.test.ts`.
- Prior decisions: `agent-docs/reference/RFC-001-community-plugin-api.md` §5,
  `agent-docs/architecture-decision-records/adr-005-shader-codegen-slang.md`.
- Standardized `bpRangeX` uniform write: `writeBpRangeUniforms(...)` across the
  five offset-poke genome renderers (`packages/render-core/src/blockClipUtils.ts`),
  patterns documented in `packages/render-core/CLAUDE.md`.
