---
name: derivative-allele-from-assembly-contigs
description: Running "Reconstruct derivative allele" over a de novo assembly's contig-vs-reference alignments instead of reads — the same chain builder, three things a PAF synteny feature lacks for it to work (a contig name, a query-side offset, and the menu item), what the picker's counts mean when the reads are haplotypes, and the one gap PAF cannot fill that an SA tag does.
---

# A derivative allele from assembly contigs

The derivative-allele picker groups split reads by the path their segments
describe ([mechanisms/derivative-allele-candidates](../mechanisms/derivative-allele-candidates.md)).
A de novo assembly contig aligned to the reference is the same object at a
larger scale — an ordered, oriented list of reference intervals, one per
alignment block — and it is the better one: HG008-T's hifiasm contig
`chr3_chr13_hap1` resolves BOTH junctions of `cluster_3` where the hosted read
slice reaches one ([reference/SV_MULTIHOP.md](../reference/SV_MULTIHOP.md),
"HG008-T"). The `sv_visualization_cgiab` tutorial already shows the contig as
a synteny track; what it cannot do is hand that contig to the picker.

`LGVSyntenyDisplay` composes the alignments display model, so
`derivativePathCandidates` and `computeReadChains` are already on it. Three
things stop them producing anything, checked 2026-08-25:

1. **A PAF synteny feature has no `name`.** `makeSyntenyFeature`
   (`plugins/comparative-adapters/src/PAFAdapter/util.ts`) builds its data
   without one, and `groupReadsByName` skips a nameless feature by rule — the
   empty-name bucket once made every block in view one enormous read. The
   query name is on the PAF line (`qname`) and is exactly the QNAME a contig
   needs: every block of one contig then lands in one bucket, which is the
   contig's chain. Check `linkedReads` before naming them, since chain mode
   groups by the same key and a named block would start chaining there too;
   that may be wanted, but it is a second consumer of the change.
2. **`clipLengthAtStartOfRead` answers 0.** `SyntenyFeature` says PAF CIGARs
   never carry clips, which is true and beside the point: the chain builder
   sorts a read's segments by that offset, and with every block at 0 the chain
   is in arrival order. The offset a contig block needs is its query-side start
   — `mate.start` when the queried assembly is the target, and the query length
   minus `mate.end` when `flip` has put the contig on the reference side (the
   read-vs-ref frame rule in
   [mechanisms/split-read-chains](../mechanisms/split-read-chains.md), rule 2).
   `segLocusKey` also reads it, which is what keeps two passes of one contig
   over a locus apart.
3. **The menu item is registered on `LinearAlignmentsDisplay` by name**, and
   `extendDisplayType` matches `element.name` exactly, so `LGVSyntenyDisplay`
   never receives "Reconstruct derivative allele...". A second
   `addDisplayMenuItems` call names it.

Two consequences the picker has to be told about:

- **The counts are haplotypes, not reads.** An assembly carries one or two
  contigs across a locus, so `minReads: 2` discards a real allele on a
  haploid-resolved event and the row says "1 reads". The floor is presentation
  (rule 8), so the synteny launch passes 1 and the row's noun becomes "contigs".
  The mismapping caveat weakens in the same move: a contig that splits across a
  repeat is rarer than a read that does, and the strip's "all one read long"
  test has no read length to measure against.
- **There is no SA tag.** A read names its off-screen segments; a PAF block
  names only its own mate span, and neither the plain nor the PIF adapter can
  query by `qname`. A contig's chain is therefore only the blocks in the
  displayed regions, so `extendsOffScreen` is never true and a single-region
  view of a translocation sees one block per contig and proposes nothing. The
  tutorial's two-slice window is the case that works. The way to fill the gap
  is an index by query name on the PIF file — a second tabix index over the
  same lines sorted by `qname`, which the existing `PifFile` collaborator could
  own — and that is the one piece of real work here.

Why it earns its place beside the read-based picker rather than replacing it:
reads say what a molecule carried, the contig says what the assembler resolved
from many, and the tutorial's "three ways" already leans on the disagreement
between them (the read slice reaches one junction, the contig two). A picker
over both, in the same dialog and the same coordinates, is what lets a reader
see that the contig's second junction is the one the reads cannot reach.

The caller-side counterpart — chaining a callset's own breakends with the
phasing GRIDSS and Esvee write — is
[linx-chains-in-the-breakend-walk](linx-chains-in-the-breakend-walk.md).
