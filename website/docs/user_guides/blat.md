---
title: BLAT and in-silico PCR
description:
  Map a sequence to genome coordinates, and find where primers amplify
guide_category: Other features
---

**TL;DR:** The `blat` plugin adds two **Tools** menu items that answer "where is
this sequence in the genome", **BLAT search** and **In-silico PCR**. Both query
UCSC-style sequence-search servers, turn the hits into a track built on the fly,
and navigate the view to the best hit.

The plugin ships with JBrowse Desktop, where both items are in the Tools menu
with nothing to install. JBrowse Web does not bundle it, so the menu items are
absent there.

## BLAT search

Choose **Tools → BLAT search…**, paste a DNA sequence or FASTA, pick the
assembly, and submit.

What comes back is a new track named after the query, holding the hits, and a
**Search results** panel listing them. Hits are ranked by UCSC's `pslScore` and
the view navigates to the top-scoring one, so a single sequence lands you on its
coordinates without any further clicks. The panel keeps the rest of them in
view, each location a link that navigates there, labelled with the percent
identity and the fraction of the query the hit covers.

The track is an alignments track. A PSL hit is a list of aligned blocks in query
and target coordinates, which is what a CIGAR encodes, so each hit is drawn the
way a read is: blocks as aligned runs, a target gap as a deletion, a query gap
as an insertion, and the unaligned ends of the query as soft clips. Because the
sequence you submitted is known, the hit also carries it, and the pileup marks
every base that disagrees with the reference. That is the difference between a
hit that is your sequence and one that merely scores well.

BLAT returns every placement of a query. The best-scoring one is primary and the
rest are marked secondary, so competing mappings of one sequence stay off the
best hit's row instead of stacking under it.

<Figure src="/img/desktop-blat-results.png" caption="A BLAT search on hg19, its two hits drawn as alignments against TP53. The best hit is a single ungapped block with two mismatch ticks, matching the 98.7% identity the Search results panel reports for it. Captured against a stand-in server, since UCSC's is CAPTCHA-gated."/>

Pasting FASTA searches each record separately, up to 25 records and 25 kb of
sequence in total. Records keep their own names, so hits from different queries
stay attributable in the track. A bare sequence with no header is named
`YourSeq` by the server.

### Which database gets searched

The assembly picker drives the UCSC database. JBrowse uses the db stamped on the
assembly's `sequence.metadata.blatDb` when there is one, then a small alias map
for the common names that are not literal UCSC db ids (`GRCh38` to `hg38`,
`T2T-CHM13v2.0` to `hs1`, and similar), and otherwise the assembly name as
typed. **Show advanced settings** exposes the resolved db so you can override
it, including with a GenArk accession such as `GCF_000001405.40`.

An assembly UCSC does not host has nowhere to search. A genome you opened from
your own files is the usual case, and the dialog says so before you submit
rather than after the server answers; if UCSC does have a database for it, set
that database under advanced settings. There is no local aligner behind these
dialogs, but [Sequence search](/docs/user_guides/sequence_search) scans the
reference for an exact pattern without involving UCSC at all.

### CAPTCHA and apiKeys

The UCSC BLAT server is length-limited, and public requests are gated behind a
CAPTCHA. You can either solve the CAPTCHA in the dialog, or paste a UCSC apiKey
(generate one from a UCSC Genome Browser account under Hub Development → API
key) to skip it. A proxy that injects a key server-side also avoids the CAPTCHA.

<Figure src="/img/desktop-blat-search.png" caption="The BLAT search dialog on hg19. Paste a DNA sequence or FASTA and pick the assembly; 'Show advanced settings' reveals the UCSC database, server URL, and apiKey field."/>

## In-silico PCR

Choose **Tools → In-silico PCR…** to find where a primer pair amplifies. Enter a
forward and reverse primer and an optional maximum product size. This uses
UCSC's `hgPcr` service and follows the same database-selection and apiKey/proxy
options as BLAT search.

Predicted amplicons arrive as a feature track with the view navigated to the
first product, and the same **Search results** panel listing every product with
its size and primer pair. There is no query sequence to align here, so this
stays a feature track rather than a pileup. Each amplicon feature spans the
whole product and is named by its size, with the forward and reverse primer
footprints as labelled subfeatures at either end, so you can see which primer
sits where on both strands.

<Figure src="/img/desktop-ispcr.png" caption="The In-silico PCR dialog on hg19. Forward and reverse primer fields with a max product size, sharing the same assembly picker and advanced apiKey/proxy options as BLAT search."/>

## Notes

Result tracks store their features inline in the session rather than referring
to a file, so they live as long as the session does and travel with it when you
save. Each search adds another track; delete the ones you are done with from the
track selector.

## See also

- [Sequence search](/docs/user_guides/sequence_search)
- [Sequence track](/docs/user_guides/sequence_track)
