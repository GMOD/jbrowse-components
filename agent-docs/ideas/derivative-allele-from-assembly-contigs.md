---
name: derivative-allele-from-assembly-contigs
description: "Reconstruct derivative allele" over a de novo assembly's contig-vs-reference alignments rather than reads — what shipped (the contig name, the query-side offset, the evidence unit), and the one gap PAF cannot fill that an SA tag does: a chain reaches only the blocks in the displayed regions until PIF is indexed by query name.
---

# A derivative allele from assembly contigs

The derivative-allele picker groups split reads by the path their segments
describe ([mechanisms/derivative-allele-candidates](../mechanisms/derivative-allele-candidates.md)).
A de novo assembly contig aligned to the reference is the same object at a
larger scale — an ordered, oriented list of reference intervals, one per
alignment block — and it is the better one: HG008-T's hifiasm contig
`chr3_chr13_hap1` resolves BOTH junctions of `cluster_3` where the hosted read
slice reaches one ([reference/SV_MULTIHOP.md](../reference/SV_MULTIHOP.md),
"HG008-T").

## What shipped

`LGVSyntenyDisplay` composes the alignments display model, so
`derivativePathCandidates` and `computeReadChains` were already on it and
returned nothing. Three things were missing, and a fourth was the unit:

1. **A synteny feature had no `name`,** and `groupReadsByName` skips a nameless
   feature by rule — the empty-name bucket once made every block in view one
   enormous read. `SyntenyFeature.get('name')` now falls back to `mate.refName`,
   the contig, so a contig's blocks land in one bucket.
2. **`clipLengthAtStartOfRead` answered 0,** which is the read-order sort key,
   so a chain was in arrival order. It is now the block's offset along the
   contig. Both the property and `get()` answer it: `extractFeatureArrays` reads
   the property on the `isMismatchFeature` branch, which a SyntenyFeature takes.
3. **The menu item named `LinearAlignmentsDisplay` only,** and
   `extendDisplayType` matches `element.name` exactly.
   `LinearDerivativeVsRef/index.ts` registers on `LGVSyntenyDisplay` too. A
   display built from another's state-model factory inherits its getters and
   none of its extensions, so this second registration is the shape every such
   subtype needs until the extension helpers understand lineage.
4. **The evidence unit is a display property.** `DerivativePathEvidence`
   (`noun`, `minReads`, `namesOffScreenSegments`) is read by the model's
   `derivativePathCandidates` and by the picker: reads/2/true on the alignments
   display, contigs/1/false on the synteny one. An assembly carries one or two
   contigs across a locus, so a floor of 2 discards a real allele and the row
   would say "1 reads"; the floor is presentation
   ([rule 8](../mechanisms/derivative-allele-candidates.md)), so it moves with
   the unit. The "all about one read long" caveat becomes a
   misassembly-across-a-repeat one for contigs, since there is no read length to
   measure against.

Two behaviour changes reachable from config, beyond the new menu item: a synteny
track with `linkedReads` set now chains a contig's blocks together rather than
treating each block as its own chain, and `lgvSyntenyTooltip`'s
`f.get('name') || f.get('id')` now prints the contig name.

## What is parked: a PIF index by query name

A read names its off-screen segments in its SA tag; a PAF block names only its
own mate span, and neither the plain nor the PIF adapter can query by `qname`.
So **a contig's chain is only the blocks in the displayed regions**:
`extendsOffScreen` is never true, and a single-region view of a translocation
sees one block per contig and proposes nothing. The tutorial's two-slice window
is the case that works.

Filling it means indexing the PIF file by query name — a second tabix index over
the same lines sorted by `qname`, which the existing `PifFile` collaborator
could own — and then a contig's whole chain is reachable from any one of its
blocks, the way a read's is from its SA tag. That is the one piece of real work
left here, and it is what would let the picker rank contigs and reads in one
list.

Why both belong in that list rather than one replacing the other: reads say what
a molecule carried, the contig says what the assembler resolved from many, and
the `sv_visualization_cgiab` tutorial's "three ways" already leans on the
disagreement — the read slice reaches one junction, the contig two.

The caller-side counterpart — chaining a callset's own breakends with the
phasing GRIDSS and Esvee write — is
[linx-chains-in-the-breakend-walk](linx-chains-in-the-breakend-walk.md).
