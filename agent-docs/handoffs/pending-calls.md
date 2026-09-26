---
name: pending-calls
description: Three calls waiting on Colin after the arc band geometry round — whether to honour a colour range the config silently drops, whether to start the arc band's port onto the link mark, and whether landing should regenerate. Each premise is checked; the questions are written out ready to re-ask.
---

The arc band geometry work is finished and landed. What is left is three
decisions, none of which an agent should settle alone. Each premise below was
verified against the code in this round — read the pointer rather than
re-deriving it, and **delete this file** once the three are answered.

## 1. A custom colour on strand / pair orientation is accepted and dropped

`isBakedScheme` (`plugins/alignments/src/shared/alignmentsColor.ts:192`) admits
only `mateRefName` and `tag`/`attribute`, and it is the gate
`bakedColorScale.ts:160` reads a declared `range` behind. So
`color: { field: 'pairOrientation', range: … }` validates, saves, and changes
nothing. This is ADR-148's last Consequences bullet, and the other half of that
sentence is the blocker: `swatchPaletteKeys` collapses `pairLR`,
`normalInsert`, `nonSplit`, `noTagValue` and `mapqUnavailable` onto one
`colorPairLR`, so a per-level override is a change to that table rather than to
the bake. `model.ts:1173` is the live consequence — `colorSetting.value` is written
over `colorPairLR`, so setting the plain read colour recolours all five and the
arc baseline with them.

**Ask:** setting the plain read colour today also recolours normal-insert
reads, unsplit reads, no-value reads, MAPQ-255 reads and the arc baseline — one
swatch, five meanings. What should a user be able to do?

- **Colour one level on its own** (recommended) — a config names a single
  level, the rest keep the shared default.
  ```
  color: { field: 'pairOrientation', range: { RR: '#d95f02' } }
  RR pairs -> orange;  LR / normal / arc baseline -> unchanged
  ```
- **Leave it, but reject the config instead of ignoring it** — a range on these
  fields becomes a validation error. Cheap; does not make per-level colouring
  possible.
- **Leave it exactly as is** — the shared grey is deliberate, those five levels
  all mean "nothing notable here", and the ADR consequence closes as won't-fix.

On the first answer, the shape is a `ReadColorCategory → RGBColor` layer
between the theme palette and its three readers — `pileupUniforms.ts:137-141`
(via `READ_CATEGORY_UBO_SLOTS`, `:73`), `categorySwatchColor`
(`colorUtils.ts:556`) and `palettes.ts`'s `resolve`. It
reaches the arcs with their nine slots intact, so it needs no palette merge;
the merge itself is declined at `palettes.ts` and that note stands either way.

## 2. The arc band onto the link mark

ADR-163 names the alignments arc band as the link mark's next consumer. The
band is four GPU passes (`arc`, `arcFlat`, `arcLine`, `arcMarker`),
`hitTestArcBand`, and `CrossRegionArcsOverlay` — the overlay being the part the
mark's `spansView` would retire outright.

**Ask:** if the arc band moves onto the link mark, how should it land?

- **Not now** (recommended) — a large job that deserves its own run.
- **Side by side behind a setting first** — compare on real data, retire the
  old path once it matches. Doubles the surface for a while.
- **Straight replacement** — port and delete in one go.

Waiting costs nothing: two of this round's four geometry fixes are in shared
render-core (`wideCircleLeg`, `curveDistance`) and the link mark already draws
through them. The other two are band-specific and retire with it.

## 3. Should landing regenerate?

Measured 2026-09-25: **26 of the last 200 commits are standalone
`pnpm autogen`**, all from that one day. Main sat red on stale generated
artifacts for most of the round; the pre-commit hook detects it and says
outright that the commit it names is "where it was last re-checked, NOT what
broke it", so every agent that commits meanwhile pays the attribution cost
before it can tell whether the staleness is its own.

**Ask:** should the land path regenerate rather than only check?

- **Yes, on the land path** (recommended) — a branch fast-forwards into main
  once, so this is one run per branch.
- **No** — leave it as a check and keep regeneration a habit.

Not the pre-commit hook: it measured ~60 s wall clock, and several generators
compile the live tree.

## Not a call, and not fixable

`540312de13` carries shader output emitted from an older tree — a rebase
conflict in `*.generated.ts` resolved by taking a side instead of regenerating,
which is the case `CLAUDE.md` names. `855427e5fd` fixed it forward 96 s later
and main regenerates clean today, so only a bisect landing exactly on that
commit builds off stale shaders.
