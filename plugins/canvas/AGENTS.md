# Canvas Plugin

## Layout requirements

A single feature can span multiple discontiguous displayed regions on the same
reference sequence (e.g. a gene spanning chr1:1-300 when the view shows
chr1:1-100 and chr1:200-300 side by side). When this happens, the feature must
receive the same Y position in every region it appears in. This means regions on
the same reference sequence (same assemblyName + refName) must share a layout.
Regions on different reference sequences should use independent layouts so that
unrelated absolute bp coordinates do not cause false overlaps.

The mechanism is `LayoutRegionData.regionKey` (`assembly:refName`), which the
model staples onto each region at fetch time and `groupRawByRef` groups by. The
key rides **on the region**, deliberately, rather than in a parallel
`Map<number, string>`: a region missing from a parallel map would fall into one
group with every other missing region and mis-stack against it, which is exactly
the failure above. On the region it is a type error instead. `baseModel`'s
`LoadedFeatureData` note says why the identity is stored with the data rather
than derived from `loadedRegions` — that map is empty during the refetch window
canvas paints through, which would collapse every region into one group.

## The space reserved for a label and the label drawn are one decision

A label here is not an overlay on top of the layout — it is _part of_ it.
Because a name is left-aligned to its glyph and spills rightward,
`computeLabelExtraWidth` widens each feature's packed box by its widest visible
label, and the packer pushes a colliding neighbour onto another row. Four other
things then re-derive that same width: the feature hit box, the highlight and
selection overlays, and the SVG export's highlight boxes.

So "which of this feature's labels render" has to be **one** predicate —
`renderedLabelSet` in `components/labelPositioning.ts` — read by the reservation
and by the emit alike. It was three: the width reservation, the walker's
early-out, and the positioner. Nothing throws when those disagree; you get a
strip of reserved whitespace with no text in it, or a label overhanging every
box that was sized to cover it, and only in whichever visibility combination
drifted.

Two asymmetries live in that predicate and are easy to "simplify" away:

- The **description is gated on `showDescriptions` alone**, not also on
  `showLabels`. Descriptions-without-names is a real state — the fit ladder's
  `labels` rung reaches it, and so does a session carrying the retired
  `showLabels: 'off'` + `showDescriptions: true` pair.
- A **subfeature label is ungated**, because it is baked in the worker and there
  is nothing main-thread to gate. `collapsed` mode suppresses it by forcing
  `subfeatureLabels: 'none'` in `rpcProps()` instead, which is why that
  substitution is there and not in the renderer.

`labelPositioning.test.ts` § "the reservation and the ink agree" pins the
property across all four visibility combinations and every subset of the three
labels.
