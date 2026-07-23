---
status: Accepted
summary: "Two \"collapse\" mechanisms stay distinct — automatic sub-pixel density-collapse vs. explicit `displayMode: 'collapsed'`; don't auto-select the preset for dense data"
---

# ADR-037: Two "collapse" mechanisms — automatic density-collapse vs. explicit `displayMode: 'collapsed'`

## Status

Accepted — the two are deliberately distinct and complementary. Do **not**
auto-promote a track to `displayMode: 'collapsed'` for dense data; the
sub-pixel density-collapse already covers that case, and better.

## Context

The canvas feature layout (`LinearBasicDisplay`, and everything that extends
`LinearCanvasBaseDisplay` — including `LinearVariantDisplay`) has **two**
separate things that put features on a single row. They share the word
"collapse" and are easy to conflate. They are not the same, and they were not
introduced together.

**1. Automatic sub-pixel density-collapse (per-feature, zoom-driven).** This is
what makes a dense SNP/variant track render as one faded band when zoomed out —
not any display-mode setting. The chain:

- **Worker** (`collect/glyphEmitters.ts`): every plain **`Box`** glyph is tagged
  `densityFade: true` (`densityFade: layout.glyphType === 'Box'`). Gene/transcript
  glyphs are **not** — only whole-feature boxes (SNPs, simple variants, BED
  features) are eligible. Flows through `pushBoxRect` into each rect
  (`collect/emitPrimitives.ts`).
- **Layout** (`packRef` in `layout.ts`): a feature is pinned to row 0 instead of
  greedy-stacked when `collapses` is true —
  `isSubPixelFade(ext, bpPerPx)` (i.e. `densityFade && renderedWidthPx <
  MIN_RECT_WIDTH_PX`) **and** it has no rendered label **and** it doesn't overlap
  a visible ("solid") feature (`!intersectsMerged(…, solidSpansPx)`). So
  thousands of ~1px marks pile onto one row rather than stacking into a tower.
  The exclusions matter: a labeled sub-pixel feature (e.g. a miRNA gene at
  whole-arm zoom) still stacks so its name doesn't overprint, and a mark abutting
  a wide gene box stacks rather than drawing on top of it.
- **Fade** (`applyLayoutToRegion` → `rectDensityFade` → `rect.slang`
  `densityAlpha`): only once at least `DENSITY_FADE_MIN` (1000) marks collapse do
  they render semi-transparent, so a genuine pileup reads as density while a
  sparse handful stays opaque and resolvable.

It is entirely automatic and driven by **on-screen width (zoom) × feature type**.
Zoom in and the marks exceed `MIN_RECT_WIDTH_PX`, so they un-collapse and stack
normally. No config, no user action.

**2. Explicit `displayMode: 'collapsed'` (whole-track, user-chosen).** A
feature-height preset alongside `normal`/`compact`/`superCompact`. When selected
it packs **every** feature onto row 0 (`singleRow` bypass in `packRef`) and
suppresses **all** labels — names via the `showLabels` getter,
descriptions via `effectiveShowDescriptions`, and worker-baked subfeature labels
via the `rpcProps` `subfeatureLabels: 'none'` override. It uses height multiplier
1 (full body height, single row). It is a deliberate "show me everything on one
line" overview, regardless of feature width. See the `displayMode` menu radio.

(Naming hazard: an **old**, removed `displayMode: 'collapse'` — no "d" — existed
briefly. It never single-rowed; it only decimated labels and was never
UI-reachable. It was deleted, and `migrateBasicSnapshot.normalizeDisplayMode`
maps a stored `'collapse'` → `'normal'`. The current single-row preset is
`'collapsed'` — with "d" — a genuinely different value and behavior.)

## Decision

Keep the two mechanisms separate. **Do not add logic that auto-switches a track
to `displayMode: 'collapsed'` when data is dense.** The per-feature
density-collapse is the correct automatic behavior; the explicit preset is a user
intent.

Auto-promoting `displayMode: 'collapsed'` for dense data would be strictly worse
than the density-collapse it would replace:

| | density-collapse (automatic) | `displayMode: 'collapsed'` (explicit) |
| --- | --- | --- |
| Scope | per-feature — only the sub-pixel ones | all features, unconditionally |
| Wide features | still stack and label normally | forced onto the one row too |
| Labels | kept wherever they fit | all suppressed |
| Conveys density | yes — fades above the threshold | no |
| Trigger | on-screen width (zoom) | user picks it |

The density-collapse preserves information the global preset throws away: it only
collapses features that are already sub-pixel (so nothing legible is lost), keeps
labels where there's room, and fades to *show* density rather than hiding it. A
whole-track switch would drop the names and single-row the wide features too.

The two also can't fight: `displayMode: 'collapsed'` takes the `singleRow`
early-out in `packRef`, which is *before* the sub-pixel branch — a collapsed
track is already one row, so per-feature density-collapse is moot there and never
runs.

## Consequences

No code change; this ADR records the distinction. When reading a "collapse" in
this subsystem, disambiguate first:

- `singleRow` / `displayMode === 'collapsed'` → the explicit whole-track preset.
- `densityFade` / `isSubPixelFade` / `collapsedFeatureIds` / `DENSITY_FADE_MIN`
  → the automatic per-feature sub-pixel path.

**Revisit if:** a workload appears where dense data is *not* sub-pixel (so
density-collapse doesn't engage) yet a single-row overview is still wanted
automatically — e.g. many medium-width features that overflow the track height.
Even then, prefer extending the density-collapse's width/threshold heuristics
over auto-forcing the label-hiding global preset.
