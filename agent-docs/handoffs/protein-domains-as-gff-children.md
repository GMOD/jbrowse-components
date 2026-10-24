---
name: protein-domains-as-gff-children
description: "Replacing ADR-242's transcriptFeatures, where a gene track fetches other tracks' rows and fits them onto its transcripts at render time, with protein domains written into the gene GFF as children of each mRNA. Three Opus reviews shaped the plan; nothing is built. Waiting on Colin: the layer slot's name (proteinDomains, proteinRegions or something more general), refusing GTF input, and the rule for a domain whose gene has no mRNA. Until it lands, a click on a transcriptFeatures row can open details from the wrong track."
---

# Protein domains as GFF children

`transcriptFeatures`
([ADR-242](../architecture-decision-records/adr-242-transcript-features-fit-by-shape.md))
has the gene track's worker open every listed track's adapter on each fetch and
fit those rows onto transcripts by exon shape. Colin (2026-10-24) reads that as
a long-term antipattern: JBrowse's strength is drawing what a GFF says, and a
tutorial can show how to prepare one. The replacement writes each domain into
the gene GFF as a child of its mRNA, and the gene glyph draws it.

- `proteinFeatures` never shipped: `v5.0.0-beta.17` (2026-10-20) predates it,
  so ADR-242's "shipped only in betas" is wrong, and the deletion needs no
  migration.
- ggjbrowse re-pinned onto `transcript_features` the same day (ggjbrowse
  `c00d4d5`); its next pin drops the argument.

## Settled by the reviews

**Where a domain hangs.**

- A domain's Parent is its mRNA. Once a CDS written as several lines under one ID has
  children, gff-nostream's `foldContinuations` merges the CDS lines into one
  feature: the CDS draws across the introns and translation reads intron
  sequence. NCBI's viral cleavage products sit under the CDS because a
  frameshift polyprotein wants that fold.
- Under the mRNA, today's glyph drops the child at the `subParts` filter
  (`RenderFeatureDataRPC/filterSubparts.ts`). UTRs, translation, collapse-introns
  and isoform picking match the plain file.
- Type `polypeptide_domain`. JBrowse reads every `*_match` type, `protein_match`
  included, as an alignment (`packages/core/src/util/featureTypes.ts:25`).
  `gt gff3validator -typecheck so` rejects `polypeptide_domain` under an mRNA,
  so the merged file is not SO-strict.
- A domain crossing introns is sibling lines sharing one ID. The parser leaves
  them as siblings, so the glyph groups them by `id`, as `productRows` in
  `glyphs/matureProteinRegion.ts` does for cleavage products.

**Other readers of an mRNA's children** select CDS by type and are unaffected:
the sequence panel and its transcript list, translation, isoform ranking,
collapse-introns, implied UTRs, protein3d (`codingFeature.ts`), msaview and
`geneLike`. Side effects:

- The details panel collapses a subfeature list longer than 20
  (`BaseFeatureDetail/FeatureDetails.tsx:116`); vav's mRNA goes from 17
  children to 28.
- GenBank export writes each domain line as a separate `misc_feature`.
- `text-index` excludes `exon` and `CDS` by default
  (`packages/text-indexing-core/src/util.ts:61`, also Desktop's "Index track"),
  so every domain line becomes a search hit.
- gffread drops the domain lines from its output, and its `-y` protein is
  unchanged. domains2genome reads CDS rows, so re-running it on the merged file
  is safe.

**Color.** Cleavage products paint by row order (`matureProteinColor(i)`,
`collect/glyphColors.ts:24`) and draw no key; that rule would paint one Pfam
family in different colors on different isoforms. Domains keep today's domain
color channel (the worker's `rectDomainColorValues`, the main thread's key, the
tables `domainLegend`), painting by `name`. With no slot, the key's title falls
back to the field and reads "name" (`shared/featureColorViews.ts`,
`colorKeyTitle`).

**The merged file.** A `cat` + `jbrowse sort-gff` merge of the honey bee RefSeq
GFF and its domains works: 154,209 domain lines take the file from 8.3 to
10.2 MB, a domain sorted ahead of its mRNA still attaches, and a 100 bp tabix
window inside vav fetches every domain of every isoform. A hand merge breaks on
gzipped input (the tutorial's NCBI file), on `##FASTA` sections (Prokka,
Bakta) and on a `.tbi` index for a contig over 512 Mb.

## The plan, in order

1. **`make-protein-features` writes the merged GFF3**, sorted, bgzipped and
   indexed (`products/jbrowse-cli/src/commands/shared/sort-utils.ts` sorts
   today). Each domain is a `polypeptide_domain` line per exon block with
   `Parent=<mRNA ID>` and an ID unique per domain per transcript. domains2genome
   prints the GFF3 lines and keeps its BED output for readers outside JBrowse.
2. **The gene glyph draws domain children** in lanes inside the transcript bar
   (`glyphs/attachedLanes.ts`), grouped by ID. Routing them through `subParts`
   would draw full-height boxes in the CDS color. Labels stay off:
   `subfeatureLabels: below` or `overlay` labels every registered line with no
   space reserved (`labelUtils.ts:180`).
3. **A click opens the whole domain.** `findSubfeatureById` returns the clicked
   line, so the sequence panel offers that one block. The click and the
   highlight build one feature from the lines sharing the GFF ID, which also
   fixes multi-line cleavage products. `resolveSubfeature`
   (`components/hitTesting.ts:193`) still returns both the transcript and the
   domain; `domainId` becomes the GFF ID and `domainTrack` goes.
4. **The layer slot** (name below) is `{ show, encoding: { color } }`, with
   `name` as the implied field and a default key title, as `pileup.mismatches`
   holds `show` and an `encoding`. The domain color code moves off the base model the
   variant display shares (`LinearBasicDisplay/baseModel.ts:396-470`) onto the
   gene display. The `domain*` identifiers (`domainPalette`,
   `domainColorValues`, the tables `domainLegend`, ggjbrowse `keys$domains`)
   take the slot's name, since `domain` is also the color scale's word.
5. **Delete `transcriptFeatures`**: the slot,
   `RenderFeatureDataRPC/transcriptFeatures.ts`,
   `LinearBasicDisplay/transcriptFeaturesArg.ts`, the RPC arg, the tables
   `transcriptFeatures` arg, the type exports at `plugins/canvas/src/index.ts`,
   and the BED `proteinStart`/`proteinEnd` check (`plugins/bed/src/util.ts`,
   b5e7b5a19b). A new ADR supersedes ADR-242 and reverts its exception to
   "no `lookup` join" in `reference/GRAMMAR_OF_GRAPHICS.md`. The fit-by-shape
   rule goes to `ideas/` as a possible offline CLI step for genome-placed BEDs
   (UniProt's bigBeds, UCSC's Pfam-in-GENCODE).
6. **`polypeptide_domain` joins `defaultFeatureTypesToExclude`** in
   text-indexing-core, which Desktop's index reads too.
7. **Tutorial and figure.** `website/docs/tutorials/protein_domains.md` loads
   one merged GFF track, `scripts/build_protein_domains.sh` builds it, the file
   is hosted under `jbrowse.org/demos/protein_domains/`, and
   `protein_domains/vav` is reshot.
8. **ggjbrowse** drops `transcript_features` (`R/features.R:172`), reads the
   merged GFF, and respells `keys$domains` with step 4. Its
   `scripts/check-against-jbrowse.sh` rebuilds the engine and runs the tests.

## Open for Colin

**The slot's name.** Colin wants something more general than `proteinDomains`.

| Name | Covers | Against |
| --- | --- | --- |
| `proteinDomains` | the tutorial's Pfam calls | narrow; `domain` is also the scale's word |
| `proteinRegions` | SO's `polypeptide_region` family: domains, signal peptides, transmembrane helices, modified residues, and the cleavage products the glyph draws today | leaves out RNA-level sites in a UTR |
| `transcriptFeatures`, given a new meaning | any child of a transcript other than its exons, CDS and UTRs, UTR sites included | needs a `types` list naming which children; "feature" already names every record in JBrowse; ADR-242 gave the name another meaning |

The lean is `proteinRegions`. It would also move the cleavage products onto the
domains' color rule and key. Whether products also leave one row per product for
lanes is a separate call, because viral products nest (Pol spans protease,
reverse transcriptase and integrase).

The slot's color needs `name` as its implied field. ADR-241 declares an implied
field on the color schema, and the vocabulary handoff adds no color-object
variant; today the display passes `impliedField: 'name'` at runtime
(`baseModel.ts:408`, `tables.ts:149`); the choice goes with the name.

**GTF input.** `make-protein-features` accepts a GTF today, and GTF has no ID
to group a domain's lines. The plan refuses GTF with a "convert with gffread"
message.

**A domain whose gene has no mRNA.** Under a viral gene → CDS, a domain with
`Parent=gene` draws each line as a separate row of boxes, and no rule for it is chosen
or tested.

**`show`.** Keep it only if a menu row should hide the domains.

## Until it lands

A click on a `transcriptFeatures` row opens its details from the wrong track
when an earlier listed track's refName map fails. `resolveTrackRefNames`
(`transcriptFeaturesArg.ts:80-90`) drops that track before the worker numbers
the rows, and `selectFeatureById` (`baseModel.ts:1627`) looks the number up in
the list before the drop. An Opus probe reproduced it with two tracks, the
first returning 404. Step 5 deletes the code; a fix that keeps it stores the
trackId instead of the position. The fixture in `selectFeatureById.test.ts`
writes `type: 'protein_domain'`, while the emitter writes the trackId there.

## Not tested

jbrowse-img and SVG export, the R side and the tables output, the new glyph's
drawing, lane crowding from multi-analysis InterProScan input, and IGV or
`gff3ToGenePred` reading the merged file.
