---
status: Accepted
summary: "scripts/sv_multihop.py is deleted. ADR-137 moved allele inference out of the app and named this script as the offline tool that may still do it; the script is ours too, and none of its three subcommands does anything an established tool does not do better — chains against LINX/Severus/gGnome, derive against a local assembly, bedpe against our own jb2export batch --vcf. JBrowse ships converters and views; the analysis belongs to the tool that specialises in it"
---

# ADR-140: SV analysis is not ours to ship

## Status

Accepted (2026-09-18). Extends
[ADR-137](./adr-137-jbrowse-shows-sv-evidence-and-does-not-infer-alleles.md),
which named `sv_multihop.py derive` as a sanctioned offline source of an allele.

## Context

ADR-137 drew the line at the application boundary: JBrowse shows evidence, and
an allele is drawn only when something outside JBrowse built it. `sv_multihop.py`
sat on the far side of that line and was therefore left alone — but it is still
our code, and the line it needs is not "outside the app" but "outside our
maintenance".

Its three subcommands were measured against one question: does this do something
no established tool does?

- **`chains`** grouped junctions into rearrangements by co-location alone. LINX
  clusters breakends under eleven rules with allele-specific copy number and a
  centromere constraint, validated across 1,479 samples; Severus resolves
  complex-SV subgraphs from phased long reads and writes a `CLUSTERID` per
  cluster into its VCF; gGnome/JaBbA walk a junction-balanced genome graph. Ours
  took a distance threshold.
- **`derive`** selected reads spanning every locus, took the longest as a
  backbone and polished it to a consensus. That is a targeted local assembly
  done with one read and `samtools consensus`; Flye, Shasta and hifiasm do the
  general form.
- **`bedpe`** converted a VCF's junctions to BEDPE rows. `jb2export batch --vcf`
  already reads the same junctions out of the same file
  (`products/jbrowse-img/src/vcfJunctions.ts`), delegating the ALT parse to
  `@gmod/vcf` rather than to regexes of our own.

The cost of keeping it was not hypothetical. Its hand-rolled ALT parse silently
dropped four classes of record a whole-genome callset routinely holds — a mate on
a colon-bearing contig, a `<TRA>` naming CHR2, the second allele of a
multi-allelic row — and answered without complaint in every case. And `chains`
ignored FILTER, so the cancer_sv tutorial taught, for as long as it has existed,
that COLO829's largest rearrangement is a four-junction chr5/chr13 chain. Every
junction in that chain is `Too_low_VAF`. It dissolves entirely once the caller's
own rejections are honoured, and the real der(3) triangle takes its place.

That is the failure ADR-137 was written about, one layer out: a plausible
picture, no error raised, and a reader with no way to see it from where they are
standing.

## Decision

- **Delete `scripts/sv_multihop.py`** and its pipeline check.
- **JBrowse ships converters and views.** A converter turns another tool's
  output into JBrowse inputs (`depmap_to_jbrowse.py`, `jb2export`'s VCF junction
  reader, `jb make-pif`). A view shows what a file says. Neither decides what a
  genome did.
- **Where analysis is truly needed and no tool provides it, it is a separate
  repository** — not `scripts/`. The bar is that it offers something established
  tools do not. Nothing here cleared it, so nothing was extracted.
- **The offline source in ADR-137's list is now an assembler or a caller**, not a
  script of ours. Its other entries — an assembly contig, a caller's own
  interpretation, a published structure — are unchanged and remain the way an
  allele reaches a figure.

## Consequences

- The cancer_sv demo's der(3) contig was built by `derive`. Reproducing it now
  means running a local assembler over the reads spanning the three loci, which
  is a heavier prerequisite than the tutorial previously asked for and a
  different contig than the hosted one. Whether the hosted reconstruction stays,
  is rebuilt from an assembly, or is retired with the rest of ADR-137's
  reconstruction work is open.
- The in-app breakend walk stays, and is the remaining place JBrowse orders
  loci from records alone. It is deliberately conservative — it stops where two
  continuations are open rather than choosing — but it is an inference, and it
  now says so where a reader meets it.
- `--loci` for any remaining workflow is a hand-written list, or comes from a
  cluster a real caller assigned.

## Rejected alternatives

- **Move it to its own repository.** Offered in an earlier session and the right
  answer for a tool that earns it. Applying the test subcommand by subcommand,
  none does: the strongest candidate, `derive`'s spanning-read filter, is a
  `samtools view` and a predicate.
- **Keep `bedpe` as a thin converter.** It converts nothing `jb2export batch
  --vcf` does not already read, and it is the copy that hand-rolls the parse.
- **Fix the parser and keep going.** Done first, in the same session, and it is
  what surfaced the FILTER defect. Four silent bugs in one parse is the argument
  for deleting the parse, not for a fifth round of checks over it.

## Revisit if

A conversion JBrowse needs has no tool that emits it — a caller's cluster output
that no adapter reads, an assembly graph no view can take. That is a converter,
and it belongs here. Analysis is what does not.
