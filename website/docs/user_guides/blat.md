---
title: BLAT and in-silico PCR
description:
  Map a sequence to genome coordinates, and find where primers amplify
guide_category: Sequence tools
---

**TL;DR:** The `blat` plugin adds two **Tools** menu items that answer "where is
this sequence in the genome", **BLAT search** and **In-silico PCR**. Both query
UCSC-style sequence-search servers and turn the hits into a track built on the
fly, with every hit listed so you can go to the one you want.

The plugin ships with JBrowse Desktop, where both items are in the Tools menu
with nothing to install. JBrowse Web does not bundle it, so the menu items are
absent there.

## BLAT search

Choose **Tools → BLAT search…**, paste a DNA sequence or FASTA, pick the
assembly, and submit.

What comes back is a new track named after the query, holding the hits, and a
**Search results** panel listing them, ranked by UCSC's `pslScore`. Each
location is a link that takes the view there, labelled with the percent identity
and the fraction of the query the hit covers.

The view does not move on its own. Which hit matters is yours to decide, and the
top-scoring one is not always it, so a query adds the track and shows you the
list rather than jumping somewhere and losing the locus you were looking at.

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
dialogs, but [](/docs/user_guides/sequence_search) scans the reference for an
exact pattern without involving UCSC at all.

### CAPTCHA and apiKeys

The UCSC BLAT server is length-limited, and public requests to it are gated
behind a CAPTCHA. Both dialogs default to a jbrowse.org proxy that supplies an
apiKey server-side, so an ordinary search meets neither the CAPTCHA nor a key —
at the cost of a request budget every user of that proxy shares.

You meet the CAPTCHA by pointing the server field at UCSC yourself, or on
desktop when the shared budget is spent and the search falls back to UCSC. Solve
it in the window that opens, or paste a UCSC apiKey (generate one from a UCSC
Genome Browser account under Hub Development → API key) to skip it. On desktop,
entering a key moves the server field to UCSC, because the proxy replaces a key
you send with its own — so a key only spends against UCSC directly.

<Figure src="/img/desktop-blat-search.png" caption="The BLAT search dialog on hg19. Paste a DNA sequence or FASTA and pick the assembly; 'Show advanced settings' reveals the UCSC database, server URL, and apiKey field."/>

## In-silico PCR

Choose **Tools → In-silico PCR…** to find where a primer pair amplifies. Enter a
forward and reverse primer and an optional maximum product size. This uses
UCSC's `hgPcr` service and follows the same database-selection and apiKey/proxy
options as BLAT search.

Predicted amplicons arrive as a track, with the same **Search results** panel
listing every product with its size and primer pair. As with BLAT, clicking a
product is what takes the view to it.

A PCR product has the shape of a paired-end read: two short oriented footprints
pointing at each other with an unsequenced insert between them. So each product
is drawn as a read pair, with view-as-pairs on, which gives the arrows-facing-
inward figure a primer pair is drawn as everywhere else. The two arrows converge
whatever strand the product is reported on, because a primer's direction is its
own and not the amplicon's, and the line between them is the interior you never
sequence.

Because the primers themselves are carried as the reads' bases, a base where a
primer disagrees with the template is drawn as a mismatch rather than assumed
away. UCSC tolerates a mismatch toward a primer's 5' end and still reports the
product, so that is the case worth seeing: the pair amplifies, but one base of
it is not annealing, which is what a primer sitting over a SNP looks like. A
mismatch in the last 15 bases at the 3' end is a different matter, since UCSC
requires those to match exactly and reports no product at all.

More than one product means more than one band. The results panel counts the
products and lists each size, which is what you compare a gel against, and says
so explicitly when there is more than one. Two products of similar size will not
resolve.

<Figure src="/img/desktop-ispcr.png" caption="The In-silico PCR dialog on hg19. Forward and reverse primer fields with a max product size, sharing the same assembly picker and advanced apiKey/proxy options as BLAT search."/>

<Figure src="/img/desktop-ispcr-results.png" caption="A primer pair for TP53 exon 8, the codon 273 hotspot, drawn as a read pair: the two footprints face inward across the 217 bp they bracket. One product, so one band. The tick near the left primer's outer end is a base that does not match the template, which still amplifies there but would not at the 3' end."/>

## Notes

Result tracks store their features inline in the session rather than referring
to a file, so they live as long as the session does and travel with it when you
save. Each search adds another track; delete the ones you are done with from the
track selector.

## See also

- [](/docs/user_guides/sequence_search)
- [](/docs/user_guides/sequence_track)
