---
name: copies-between-each-parser-and-its-instance-buffer
description: Each gmod parser's output is copied before the GPU instance buffer (alignments' per-event objects, BED's second object, VCF's five objects a variant), and grammar rule 1 refuses any copy the drawing gives no reason for.
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
per-variant objects. The mark display over a BigWig already reads bbi's arrays
as a column table (ADR-193); wiggle's interleave is its own step, since ADR-227
keeps the wiggle display off the encoder.
