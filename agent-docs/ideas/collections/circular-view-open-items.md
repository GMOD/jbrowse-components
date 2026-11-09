---
name: circular-view-open-items
description: "Open circular-view items after the ring, chord and circular-synteny rounds (ADR-177): no fetch gate on chords, overlay canvases never reaching a ring, ordinal-x displays on a ring, same-loci SVs merging into one chord, zoom rebuilding the ribbon hit cache, the Canvas2D rung's per-frame repaint."
---

# Circular view open items

Each waits on Colin's call unless it says otherwise. The circular-synteny
demos build with `scripts/build_circular_synteny.sh` and
`build_circular_synteny_fasta.sh`.

**Chords fetch with no gate.** `chords/BaseChordDisplay.ts` sets
`regionTooLarge: false`, so a whole-genome VCF (ClinVar on hg38) is fetched onto
the main thread and almost all of it draws nothing. The proposed fix fetches
through ADR-163's `mate` step, so the worker drops records with no other end;
medium-high cost, and it touches the SV inspector's `visibleFeatureIds`. The
stall is unmeasured.

**Overlay layers never reach a ring.** A ring samples one canvas per strip
(`ringStripCanvas`, the display's marked picture since ae28f756e7), so the
OverlayCanvas layers drawn over it (density band, indel glyphs, alignments
labels, MAF overlays) are dropped.

**Ordinal-x displays as rings** (`variantLayout: 'columns'`, LD): columns spread
over the whole circumference at the wrong angles and the connector band drops.
Refuse the layout on a ring or force it genomic: undecided.

**Two SVs at the same two loci draw as one chord.** The junction key is
`ref:pos|ref:pos` only, so a `<DEL>` and a `<DUP>` at identical coordinates
merge. Colin: "tricky, could punt unless clear win"; punted until real data hits
it.

**A zoom rebuilds the ribbon hit cache** (`ribbonHitTest` in
`chords/chordHit.ts`): the stage radius changes, where a rotation keeps it.

**The Canvas2D rung repaints every frame**, seconds at 67k ribbons.

**Smaller gaps:** the ring host's coarse blocks have no first-measure seed (none
needed so far); `panX`/`panY` are not persisted; callouts leave nested
subfeatures (SARS mature peptides) unnamed, their leaders cross gene rows, and a
long name can clip in a square export; the view's px layout words
(`spacingPx`, `paddingPx`, `minimumRadiusPx`, `minVisibleWidth`) wait on the
app-wide layout respelling.

**Parked:** the route clip, the polyploid circle, the track-management mixin, a
worker-side length filter, and lifting `shapeFor`/`shapePathFor` into
`BaseChordDisplay` (a few duplicated lines, not worth an abstract MST method).

**Accepted as is:** a closed ring's axis sits on the origin over the data; the
field-painted chord key fades its swatches by the chords' `opacity`; a ring's
facet sections carry no labels (Colin did not want them).
