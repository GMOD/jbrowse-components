---
name: copies-between-each-parser-and-its-instance-buffer
description: A census of the copies between each gmod parser's output and the GPU instance buffer - alignments' per-event objects, the feature display's per-primitive objects and BED's second object, wiggle's interleave, VCF's five objects a variant - ranked by data touched. Rule 1 of the grammar refuses each one the drawing gives no reason for; each waits on its own bench against the path it replaces.
---

# Copies between each parser and its instance buffer

Rule 1 of the grammar
([GRAMMAR_OF_GRAPHICS.md](../../reference/GRAMMAR_OF_GRAPHICS.md) §"Four rules
for how far to take it"): the GPU instance buffer is the one new representation
the drawing needs, and any other copy between the parser and that buffer needs
a reason the drawing gives.

Traced on 2026-09-23 through `~/src/gmod/` and the tree; the ranking by data
touched is inferred from typical region sizes, not measured. No path hands the
parser's arrays to the GPU unchanged.

| Family | Parser answers | What the tree adds before the instance buffer |
| --- | --- | --- |
| BigWig → wiggle | `Int32Array` starts and ends, `Float32Array` scores (`bbi-js/src/block-view.ts`) | `processFeaturesFromArrays` interleaves the positions and copies the scores (`plugins/wiggle/src/util.ts`); the main thread builds per-source layers |
| BigWig → mark display | the same | a `BigWigFeature` object per row (`BigWigAdapter.ts`), collected into a `Feature[]`, encoded to lanes, a Flatbush; measured at 1.25–2.67x wiggle at screen scale, 0.04–0.45 ms a region ([MARK_ENCODING.md](../../reference/MARK_ENCODING.md) §"The mark display over a BigWig, measured") |
| BAM / CRAM → pileup | `BamRecord` getters over the chunk; CRAM a (slice, index) view over typed columns. Our feature class is the parser's `recordClass`, so no wrapper | a `FeatureData` object per read, and a Mismatch, Gap or Insertion object per event, one per aligned base in the per-base modes (`plugins/alignments/src/features/*/extract.ts`), then typed arrays |
| VCF → variant displays | tabix a string per line; vcf-js a `Variant` with the first nine columns and INFO parsed, samples left in the line | five or six objects per variant on the matrix path (`VcfFeature`, its `data`, `FilteredVariant`, `simplifiedFeature`, `featureData`); genotypes scanned in place twice, not copied |
| BED / GFF3 / BigBed → feature display | bed-js an object with every column; GFF3 a lazy feature with raw attributes | BED spreads into a second object, then a `SimpleFeature` (`plugins/bed/src/util.ts`); the RPC builds a layout tree and a Rect, Line or Arrow object per primitive before `packRenderArrays` |

Hi-C's single-pair concat was the sixth row; `03b6ba40ab` dropped it.

The encoder reads a plain field as `feature.get(ref)` through one reader per
channel (`packages/core/src/util/fieldReader.ts`), so its cost over any adapter
is the adapter's feature object. BAM's is the parser's own; BED's is two copies
deep.

## The work

Each row is a candidate, benched against the path it replaces before it lands.
In order of data touched: alignments' per-event objects, the feature display's
per-primitive objects and BED's second object, wiggle's interleave, VCF's
per-variant objects. The mark display over a BigWig reading bbi's view by
index, rather than an object per row, is the rule-1 form of ADR-152's column
encoder, and ADR-152's two lane fixes (no `featureIndex` when nothing
reorders, a constant colour as a scalar) still gate wiggle itself.
