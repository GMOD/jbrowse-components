---
status: Accepted
summary: "The mark display hides a color key row's categories through a Categories menu of checkboxes, as multi-row does: `hiddenCategories`, session state of `{ field, value }` records (`field` `''` under an identity color, `value` the color its `domain` lists), folds into the categorical and identity `ColorSource`, and painting the keys drops the hidden instances from every lane (`keptInstances`), rebuilding the hit index, so the plot, the hover, export, the column sort and the cluster matrix lose them at once and nothing refetches. The key keeps a hidden row struck through, under a row focus too; \"Show all categories\" joins Filter by.... A hide keys on data, so two palettes hide the same features, and a field change leaves it latent until the field returns. Third gap of the multi-row-on-marks handoff"
---

# ADR-246: A mark key row hides its categories for the session

## Status

Accepted (2026-10-25). The third gap in
the multi-row swap plan, retired by
[ADR-249](adr-249-the-multi-row-display-is-the-mark-display-with-a-paintings-default-plot.md). A Fable
design read weighed the options below against the code; this records its
recommendation as built.

## Context

The multi-row display hides a color key's categories from paint and hit
test through a Categories submenu. The mark display had no such control, so
a ChromHMM painting on it could not drop "15 Quiescent / low" to show the
active states.

## Decision

- **Session state, as multi-row's and ADR-219's `hiddenLaneNames`:**
  `hiddenCategories`, a list of `{ field, value }`. The value is a key the
  worker sent, a field value, or under an identity color a `domain` color as
  the key lists it.
- **Applied where the colors resolve.** `markColorOf` folds the hidden
  values for each color's field into its `ColorSource`, and `colorByKeys` and
  `colorByOwnColors` drop the instances whose key is hidden
  (`keptInstances`): every lane compacted alike, `featureIndex` still naming
  each feature, the hit index rebuilt. Nothing is dropped and nothing is
  copied while nothing is hidden.
- **Everything downstream reads the colored layers**, so a hidden category
  leaves the plot, the hover, SVG export, the column sort and the cluster
  matrix together, and no request changes.
- **The key keeps a hidden row**, struck through: the color table flags the
  entry `hidden`, and a row focus, which trims the key to the colors drawn,
  keeps a hidden entry so its row stays the way back.
- **The menu:** "Categories (n hidden)", one checkbox per key row, up to 30,
  and "Show all categories" among Filter by...'s narrowings.
- **A hide keys on data.** A palette edit keeps it; a field change leaves it
  unapplied and uncounted (`activeHiddenCategories`) until that field is
  colored again.

## Consequences

- A key row merging several values toggles all of them.
- An identity color with no `domain` lists no rows, so it offers no hide
  until that key gap closes.

## Rejected alternatives

- **The `filter` predicates.** The grammar's word, but on the mark display a
  filter is a worker step, so each toggle refetches, and an identity color
  has no field a predicate can name.
- **`facet.hidden`.** A facet section is not a color category, and the slot
  is config that rides a share link.
- **`legend.values`.** It says which rows the key lists, as Vega-Lite's
  does; dropping data under it would give one word two meanings.
- **A zero-alpha mask per instance.** The span shader has no alpha discard
  and the hit test reads no alpha, so every consumer would gain a check.
