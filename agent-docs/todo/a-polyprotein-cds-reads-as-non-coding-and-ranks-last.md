---
name: a-polyprotein-cds-reads-as-non-coding-and-ranks-last
description: both coding helpers look for a CDS descendant, so a polyprotein's own CDS reads as none
metadata:
  area: canvas
  category: ready
---

# A polyprotein CDS reads as non-coding and ranks last

Both helpers that judge an isoform's coding status look for a CDS **descendant**,
and a polyprotein's CDS *is* the CDS — its children are `mat_peptide` cleavage
products, not a CDS:

- `hasCodingSubfeature` (`RenderFeatureDataRPC/glyphs/glyphUtils.ts`) returns
  **false** for it.
- `codingLength` (`glyphs/subfeatures.ts`) returns **0**.

`rankIsoforms` compares canonical rank, then the coding BOOLEAN, then coding
length — so an untagged polyprotein sorts below every ordinary mRNA in the gene
regardless of protein size, and the same `scores` map drives the stack sort, so
it sinks to the bottom even when nothing is dropped. On a viral genome that
hides ORF1ab.

The bug is pre-existing rather than a consequence of the `auto` isoform cap
measuring packed rows (`575817490c`), but the cap is what made it visible: a gene
that used to sit under a count-based cap and draw everything can now collapse,
and then this ranking drops the polyprotein. The untouched `longestCoding` path
already keeps a plain mRNA over a 16-product polyprotein, which demonstrates it
without involving the cap at all. `test_data/` has SARS-CoV-2 ORF1ab and
enterovirus D.

**First move: fix the two helpers, not the ranking comparator.** A feature whose
own type is CDS is coding, and its length is its own. Check every
`hasCodingSubfeature` caller before widening it — glyph dispatch and colouring
read it too.
