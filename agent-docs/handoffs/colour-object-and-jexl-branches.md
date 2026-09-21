---
name: colour-object-and-jexl-branches
description: The follow-ups to a 2026-09-21 review of the grammar-of-graphics colour work, whose two branches (one colour resolver, ADR-153; jexl admitted only where a slot declares contextVariable, ADR-155) have landed. In order: the wiggle origin/pivot split, the Solid-and-back redesign, colour rules on every display, a wiggle threshold with N cuts, and the lane-split table. Read before touching colorEncodingOf, a colour object's field slot, jexl admission in ConfigSlot, or a menu's constant/field switch.
---

# Colour object and `jexl:` admission: what follows the two branches

Background: [GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md),
[ADR-133](../architecture-decision-records/adr-133-a-channel-objects-slots-are-each-valid-alone.md),
[ADR-151](../architecture-decision-records/adr-151-a-channels-scale-is-spelt-as-scales-y-spells-one.md).
A 2026-09-21 review, re-checked by an adversarial second reviewer, found the
shared colour object spelt one way on six displays but resolved six ways, and
`jexl:` doing two jobs under one prefix. Mark an item **landed** with its
commit; file what nobody takes up into [ideas/](../ideas/README.md) and delete
this file.

## Both branches landed

- **Colour object**, landed at `ca093aa3cb`
  ([ADR-153](../architecture-decision-records/adr-153-every-display-resolves-its-colour-through-one-function.md)).
  Found and left: the wiggle density ramp measures distance from `domainMid`
  rather than placing its middle stop there, and a `linear` scale with no range
  falls back to the two-sided fade instead of viridis. Both fixed with step 1.
  `alignments-colour-pipeline.dot` is stale on main (`pnpm diagrams:check`).
- **`jexl:` admission**, landed at `5efdbab034`
  ([ADR-155](../architecture-decision-records/adr-155-a-slot-takes-a-callback-only-where-it-declares-one.md)):
  the `featureField` slot type, 12 field slots on it, and the refusal. No
  `test_data` config writes a callback into a slot that refuses one. A `jexl:`
  field on an aggregate op is refused at load now, with the generic message
  rather than `step-field-expression`'s pointer at `formula`.

Left open from the `jexl:` work:

- A `jexl:` string inside an array slot's entry (`jexlFilters`, `groupby`,
  `pileup.fields`) is not refused.
- `jb2export`'s `color:` modifier cannot carry a `jexl:` value through its `:`
  split.
- In products without MST type checking (everything but web), the refusal is
  the snapshot preprocessor alone.
- `geneColor.ts:74` reads `utrColor` behind an `isJexl` guard, red on main:
  the item [adr-150-review-followups](adr-150-review-followups.md) records.

## Next, in order

1. **Wiggle bars grow from `origin`: landed** at `c2ff455203`, with the two
   density-ramp items. Canvas2D and WebGL2 captures agree; WebGPU was checked
   by the shader build and `webgpuHalBindingVisibility.test.ts` only.
2. **Solid-and-back: landed** at `358bdbd5ba`. Every Color by pick writes
   through display-kit's `colorForField` / `colorForValue`, which fixed
   Manhattan (and synteny and multi-way) dropping a declared scale on a
   re-pick. LGVSyntenyColor needs nothing: `{}` paints strand,
   `{ scale: 'none' }` the plain fill, `{ value, scale: 'none' }` a constant.
   Open, waiting on Colin: `none` shares the `scale` slot, so a declared
   `linear`/`log` comes back through the field's default scale after the
   constant and back (`showSoftClipping.test.ts`, "Normal and back keeps the
   field, range and ends of a linear tag").
3. **Colour rules on every display.** `threshold-cuts`, `ramp-domain` and
   `ramp-ends` live only in the mark display's rule list
   (`plugins/marks/src/LinearMarkDisplay/markProblems.ts`), so a bad colour
   object says nothing on the other five displays. Move them beside the object
   in display-kit and give each display a `notices` getter and its chip;
   `jbApi.ts` already reads `display.notices` duck-typed. Add the missing check
   that a threshold's `range` has one more colour than its cuts
   (`thresholdPalette` tops it up silently). With the rules moved, a small
   shared workspace package beats `scripts/generateMarkRules.ts`'s copy into
   the CLI, as `@jbrowse/add-track-core` is shared today; without the move,
   keep the copy.
4. **A wiggle `threshold` with N cuts**, by ggplot2's rule that a segment takes
   its start point's bin. Fills cost nothing, since each instance carries its
   colour; the lines and band are a shader change to `pivotSideColor`. After
   step 1.
5. **The lane-split table.** Branch `lane-split-on-lazy-shaders`
   (`db22edd79c`, whose ADR is also numbered 152). `shapeSpecs.ts` lands alone
   if `rows: 'banded'`, the row skip in `markLanes` and the `banded` flag in
   `markEntryOf` stay on the branch. The second shader pass per shape waits on
   lazy layout modules, 14,173 bytes per realm eager today. The superseded
   copies `lane-split-held`, `worktree-agent-a17c3133a78d5d594` and the
   replaced validator draft `worktree-agent-ac122262301221b0e` can go.

## Declined in the review

File these into ADR-151's and ADR-148's Rejected rows when the thread closes.

- **`domain: [min, max]` under a linear colour scale**, Vega-Lite's spelling.
  It brings back two spellings of one pin and a precedence rule, and `scales.y`
  has one. Step 3's report is the fix for the trap.
- **Renaming alignments' runtime scheme names to the field names.** The shader
  takes an integer, so no hot path gains, and `ReadColorBy`'s parsed tag form
  is worth keeping.
