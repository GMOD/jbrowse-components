---
name: circular-view-open-items
description: "Open circular-view items after the ring, chord and circular-synteny rounds (ADR-177): records under the chord gate that draw nothing, overlay canvases never reaching a ring, same-loci SVs merging into one chord, zoom rebuilding the ribbon hit cache, the Canvas2D rung's per-frame repaint."
---

# Circular view open items

Each waits on Colin's call unless it says otherwise. The circular-synteny
demos build with `scripts/build_circular_synteny.sh` and
`build_circular_synteny_fasta.sh`.

**A file under the chord gate still ships records that draw nothing.** The
chord variant display gates on the index's estimate of the whole fetch against
the adapter's `fetchSizeLimit` (`installChordFetch`), which stops ClinVar,
1000 Genomes sites and the HPRC SV callset at the banner, where ungated they
froze the tab for 15-38 s or ran the worker out of heap. A file under 5 MB
still fetches every record, and a SNV or small indel is a chord whose two ends
are one locus: ClinVar shown on chr22 alone (4.4 MB, about 100k records) loads,
and almost none of it draws. The lever is the worker dropping records with no
other end, through ADR-163's `mate` step, before they are collected; it touches
the SV inspector's `visibleFeatureIds`.

**Overlay layers never reach a ring.** A ring samples one canvas per strip
(`ringStripCanvas`, the display's marked picture since ae28f756e7), so the
OverlayCanvas layers drawn over it (density band, indel glyphs, alignments
labels, MAF overlays) are dropped.

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

**Parked:** the route clip, the polyploid circle, the track-management mixin,
and a worker-side length filter.

**Accepted as is:** a closed ring's axis sits on the origin over the data; the
field-painted chord key fades its swatches by the chords' `opacity`; a ring's
facet sections carry no labels (Colin did not want them).
