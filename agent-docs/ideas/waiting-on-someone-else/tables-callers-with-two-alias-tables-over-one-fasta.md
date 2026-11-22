---
name: tables-callers-with-two-alias-tables-over-one-fasta
description: Two @jbrowse/tables-only bugs when one FASTA config is read under different alias tables, which the app never does — CRAM decoding against another request's spelling, and render-side reference reads skipping CRAM's spelling check. Read if a tables user reports a CRAM decoding wrong.
---

# Tables callers with two alias tables over one FASTA

Waits on a @jbrowse/tables user hitting it. In the app one CRAM instance has
one FASTA, and `originalRefName` is that FASTA's spelling
([REFNAME_NAMESPACES](../../reference/REFNAME_NAMESPACES.md#the-reference-is-part-of-the-adapters-identity)).

## CRAM decodes against another request's spelling

`CramAdapter`'s `seqIdToOriginalRefName` is written per `getFeatures`. A
concurrent read of the same contig under another spelling overwrites it before
the first read's `seqFetch` runs, and a spelling change clears the whole record
cache, so alternating callers thrash.

- Keying the instance on the alias spelling contradicts REFNAME_NAMESPACES (an
  alias spelling hashes to one instance) and parses the index once per alias
  table.
- Passing the name into the fetch does not work alone: @gmod/cram's
  `fetchReferenceSequence` takes `(seqId, start, end)` and its record cache is
  shared.
- What would work: serialize reads per refId when the spelling differs, or key
  the record cache on the spelling.

## Render-side reference reads skip the spelling check

`plugins/alignments/src/shared/fetchReferenceSequence.ts` (bisulfite, splice
motifs, consensus) reads `originalRefName || refName` without CRAM's
`resolveSeqFetchRefName` membership check, so under tables it can miss a contig
CRAM decodes. Sharing that resolution needs it moved out of `CramAdapter`.
