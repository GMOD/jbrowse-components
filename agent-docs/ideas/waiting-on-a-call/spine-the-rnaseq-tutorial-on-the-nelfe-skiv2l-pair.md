---
name: spine-the-rnaseq-tutorial-on-the-nelfe-skiv2l-pair
description: The RNA-seq tutorial walks four loci whose sections could be reordered without breaking; building it on the NELFE/SKIV2L pair it already ends its strand section on would make it one line of work, and its strand tour waits on that call.
---

# Spine the RNA-seq tutorial on the NELFE/SKIV2L pair

[rnaseq.md](../../../website/docs/tutorials/rnaseq.md) reads splice arcs and
spliced-read sorting over _ACTB_, IsoSeq isoforms over _ACTB_, strand coloring
over the surfeit locus and strand grouping over _NELFE_ and _SKIV2L_, then a
circular RNA and junction tables. Each section works on its own, which is the
user-guide shape [WEBSITE_WRITING.md](../../reference/WEBSITE_WRITING.md)
§"Page scope and order" names.

## The proposal

Spine the page on the MHC class III pair (_NELFE_ and _SKIV2L_, back to back on
opposite strands, `chr6:31,920,500-31,933,000`), a question a reader can hold:

- Read height is how the reader sees the stack.
- The CIGAR is why some reads jump.
- `XS` is why the arcs are colored.
- First-of-pair strand is the answer.
- Opening the reads under each gene, grouped by strand, is the closing check.

_ACTB_ and IsoSeq stay as one figure each only if they answer something the
spine raised.

## The call

Restructure the page this way, or move its guide material to `user_guides/`,
where `alignments_track.md` already covers half of it, or leave it as is.

## The tour that waits on it

`rnaseq/group_by_strand`: **Group by → First-of-pair strand** on the
_NELFE_/_SKIV2L_ window. Film it after the call; filming a page whose sections
reorder films the confusion.
