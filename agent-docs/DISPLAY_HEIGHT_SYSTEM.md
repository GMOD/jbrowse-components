# Display height system — current state and redesign ideas

Notes for a possible future cleanup of how a display's pixel height is set.
Captured while improving the trio-crossover tutorial screenshots, where wanting
to set the hap-ibd painting's height from a session snapshot surfaced the rough
edges below. Nothing here is implemented — it's a menu of options.

## How height works today

`TrackHeightMixin` (`plugins/linear-genome-view/src/BaseLinearDisplay/models/
TrackHeightMixin.tsx`) is composed into ~every display:

- persisted property **`heightOverride`** (`types.maybe`, refined `>= MIN_DISPLAY_HEIGHT`)
- getter **`height`** = `heightOverride ?? config.height` slot
- `setHeight` / `resizeHeight` write `heightOverride`
- a **`preProcessSnapshot`** (`migration.ts → migrateTrackHeightSnapshot`)
  rewrites a bare `height` (and legacy `heightPreConfig`) in an incoming snapshot
  to `heightOverride`

So the prop/getter name collision (`height` is a getter, can't also be a
settable prop) is resolved by the `Override` convention from
`/Users/colin/.claude/CLAUDE.md` ("store `<name>Override`, keep the bare
`<name>` getter returning a resolved value").

`LinearMultiRowFeatureDisplay` (`plugins/canvas/.../model.ts`) layers a second
knob on top:

- persisted **`rowHeightOverride`** (`0` = auto-fit, `>0` = pinned px per row)
- `fitTargetHeight` = `heightOverride ?? config.height`
- auto-fit mode: `rowHeight = fitTargetHeight / nrow`, and `height = nrow * rowHeight`
- pinned mode: `rowHeight = rowHeightOverride`, `height = nrow * rowHeightOverride`

## The friction

1. **You can't set `height` natively in a display snapshot.** Writing
   `displaySnapshot: { height: 140 }` only works because of the back-compat
   migration; the "real" field is `heightOverride`. This is surprising — config
   slots are `height`, drag-resize reads `height`, but the snapshot field is
   `heightOverride`.
2. **`height` vs `heightOverride` ambiguity for multi-row.** For the multi-row
   painting, `heightOverride` is the *total* the rows divide, while the `height`
   getter is the *resolved* total (`nrow * rowHeight`). Setting `heightOverride`
   in auto-fit mode does the intuitive thing (total height, rows auto-fit), but
   the name doesn't say so.
3. **Two override knobs.** `heightOverride` (total) and `rowHeightOverride`
   (per-row) interact through `rowHeightSetting === 0`. Workable but easy to get
   wrong from a snapshot — e.g. setting `height` has no visible effect when a
   non-zero `rowHeight` is pinned.
4. **`Override` in the serialized name.** The user's stated preference is that
   the snapshot/API name be `height`, not `heightOverride`.

## Workaround used for the screenshots (no infra change)

`website/scripts/screenshot-specs.ts` sets `rowHeightOverride: 32` on the
hap-ibd painting — a real native prop, no migration involved — to make the
painting slightly taller, then hand-tunes the annotation row Y-coordinates
(`TRIO_VCF_ROW_TOP`, `TRIO_PAINT_TOP`) to the resulting layout. Fine for a
deterministic screenshot; not a general fix.

## Redesign options (pick one if/when this is tackled)

### A. Native `height`, scoped to one display

Give a single display a settable `height` property and resolve the config
default without the `Override` getter. Smallest blast radius; doesn't help other
displays. The collision is avoided by not composing `TrackHeightMixin`'s `height`
getter (or by overriding it).

### B. Refactor `TrackHeightMixin` globally to a native `height`

Replace `heightOverride` + getter with a persisted `height` seeded from the
config slot (e.g. `types.optional` with an `afterCreate`/snapshotProcessor that
fills the config default), update every `display.height` reader (there are many),
and delete `migration.ts`. Cleanest end state, but touches every display type and
needs broad testing. Watch for code that distinguishes "user set a height" from
"using the config default" — today that's `heightOverride !== undefined`.

### C. `types.snapshotProcessor`

Keep internal storage but expose `height` as the external snapshot field via a
bidirectional `snapshotProcessor` (pre: `height → heightOverride`, post:
`heightOverride → height`). Medium blast radius, removes the one-way migration,
but `Override` still exists internally, so it only half-satisfies the "no
override in names" goal.

### Multi-row specific

Whichever of A–C is chosen, decide how `height` (total) and `rowHeight`
(per-row) compose: simplest mental model is "set `height` ⇒ auto-fit rows; set
`rowHeight` ⇒ pin rows and grow total." Keeping `rowHeight: 0 = auto-fit` is a
fine sentinel, but a snapshot author setting `height` while a non-zero
`rowHeight` is pinned should probably win on `height` (auto-fit) or at least not
silently no-op.

## Convention note

Any change here should be reconciled with the `<name>Override` convention in
`~/.claude/CLAUDE.md`. If `height` becomes a native settable prop, that
convention either gets an explicit exception for height-like resolved-default
values, or is revised.
