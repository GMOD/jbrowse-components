---
title: BLAT and in-silico PCR
description:
  Map a sequence to genome coordinates, and find where primers amplify
guide_category: Sequence tools
---

The `blat` plugin adds two **Tools** menu items that find where a sequence is in
the genome, **BLAT search** and **In-silico PCR**. Both query UCSC-style
sequence-search servers and turn the hits into a track built on the fly, with
every hit listed so you can go to the one you want.

## Where it is set up

BLAT search and In-silico PCR come pre-installed on the hosted genomes, with
nothing to set up:

- **JBrowse Web:** every genome on
  [genomes.jbrowse.org](https://genomes.jbrowse.org)
- **JBrowse Desktop:** every genome opened from **Browse hosted genomes** on the
  start screen, which are the same configs

There, a search goes to UCSC's own BLAT and In-silico PCR servers, through a
[shared jbrowse.org server](#the-shared-server) that needs no UCSC account.

Anywhere else takes setup. Neither JBrowse Web nor JBrowse Desktop bundles the
plugin, so a genome opened from your own files or config lacks the two items
until:

- **The plugin:** the config's `plugins` names it.

  ```json
  {
    "$schema": "https://jbrowse.org/jb2/schema/v5/config.json",
    "plugins": [
      {
        "name": "Blat",
        "url": "https://jbrowse.org/plugins/jbrowse-plugin-blat/latest/dist/jbrowse-plugin-blat.umd.production.min.js"
      }
    ]
  }
  ```

- **The database:** UCSC searches only the assemblies it hosts, so the assembly
  has to be one of them, under its UCSC name or with the
  [database set](#which-database-gets-searched).
- **A server of your own:** a genome UCSC does not host needs a UCSC Genome
  Browser mirror that has it, entered in the dialog's server field. The browser
  calls that server directly, so it has to send CORS headers or share your
  JBrowse's origin.

## BLAT search

Choose **Tools → BLAT search...**, paste a DNA sequence or FASTA, pick the
assembly, and submit.

What comes back is a new track named after the query, holding the hits, and a
**Search results** panel listing them, ranked by UCSC's `pslScore`. Each
location is a link that takes the view there, labelled with the percent identity
and the fraction of the query the hit covers.

The view stays where it was, and you choose the hit; the top-scoring one is not
always the right one.

The track is an alignments track, so each hit is drawn the way a read is:

- **Blocks:** aligned runs, with a gap in the reference as a deletion, a gap in
  the query as an insertion, and the unaligned ends of the query as soft clips.
- **Mismatches:** the hit holds the sequence you submitted, and the pileup marks
  every base that disagrees with the reference, so a hit that is your sequence
  can be told from one that only scores well.
- **Introns:** a transcript's hit draws its introns as thin lines, the way a
  spliced RNA-seq read does. A hit counts as spliced when at least half of its
  long reference gaps sit on splice sites (GT…AG, or CT…AC on the other strand);
  every other gap draws as a deletion.
- **Secondary hits:** BLAT returns every placement of a query. The best-scoring
  one is primary and the rest are secondary, so competing mappings of one
  sequence stay off the best hit's row.

<Figure src="/img/desktop-blat-steps.png" caption="A BLAT search on hg19: the dialog with a stretch of HBG2 pasted (1), and its hits on HBG2 and on the paralog HBG1, whose ticks mark the bases that differ."/>

Pasting FASTA searches each record separately:

- **Limits:** up to 25 records, 25 kb in any one record and 50 kb across the
  submission.
- **Names:** each record keeps its name, so hits from different queries stay
  attributable in the track. The server names a bare sequence with no header
  `YourSeq`.
- **Results:** the **Search results** panel lists the hits under the record they
  came from, in the order the records were pasted, and names any record that
  found nothing.

### Starting from a read or a selection

The dialog also opens filled in from what is on screen, on the assembly of the
view it was opened from. The search runs when you press Submit.

- Right-click a read in an alignments track and open **Launch**. **BLAT read**
  searches the read's whole sequence, and **BLAT soft-clipped bases** searches
  each clipped end of 20 bases or more as its own record, named
  `<read>_left_clip` and `<read>_right_clip` for the side of the pileup it is
  drawn on. A clip that maps elsewhere marks a breakpoint, a chimeric read or an
  insertion of sequence from another locus.
- Drag a selection across the ruler and choose **Launch → BLAT selection** to
  search the selected reference bases, which finds the region's paralogs and
  duplicated copies. A selection spanning several displayed regions is sent as
  one record per region.

An item stays disabled, with the reason in its tooltip, when the sequence is
over the limits above.

### Which database gets searched

The assembly picker drives the UCSC database, resolved in this order:

- the db stamped on the assembly's `sequence.metadata.blatDb`, when there is one
- a small alias map for the common names that are not literal UCSC db ids
  (`GRCh38` to `hg38`, `T2T-CHM13v2.0` to `hs1`, and similar)
- the assembly name as typed

**Show advanced settings** exposes the resolved db so you can override it,
including with a GenArk accession such as `GCF_000001405.40`.

A genome you opened from your own files is usually not on UCSC, and the dialog
warns before you submit. If UCSC does have a database for it, set that database
under advanced settings. [](/docs/user_guides/sequence_search) scans the
reference for an exact pattern without involving UCSC.

### The shared server

UCSC answers programmatic BLAT only with an apiKey, and only one query at a time
per key. Both dialogs send their query to a jbrowse.org server that holds a key,
so a search needs no account, and every user of that server shares its budget:

- **Queue:** a search made while another holds the slot waits its turn, with a
  line in the dialog saying how long.
- **Quota:** each network gets a share of the budget per hour and per day, and a
  search past it says when the share renews.
- **Your own server:** **Show advanced settings** has the server field, for
  pointing the dialogs at a mirror or a proxy of your own. The jbrowse.org one
  is
  [a small AWS Lambda](https://github.com/GMOD/jbrowse-components/tree/main/products/aws/blat-proxy)
  that a site with its own UCSC apiKey can deploy, to stop sharing the budget.

## In-silico PCR

Choose **Tools → In-silico PCR...** to find where a primer pair amplifies. Enter
a forward and reverse primer and an optional maximum product size. This uses
UCSC's `hgPcr` service, through the same shared server, and picks the database
the same way as BLAT search.

Predicted amplicons are added as a track, with the same **Search results** panel
listing every product with its size and primer pair. As with BLAT, clicking a
product takes the view to it.

Each product is drawn as a read pair with view-as-pairs on: the two primers'
footprints point at each other whichever strand the product is reported on, and
the line between them is the unsequenced interior.

The primers appear as the reads' bases, so a base where a primer disagrees with
the template is drawn as a mismatch. UCSC's matching rules:

- **3' end:** the last 15 bases of each primer must match exactly, or UCSC
  reports no product.
- **Reverse primer's 5' tail:** passes with at least two matches per mismatch,
  so a 20-mer sitting over a SNP still amplifies but one with two mismatches in
  its first five bases does not.
- **Forward primer's 5' tail:** not checked.

The results panel counts the products, lists each size to compare against a gel
(where products of similar size will not resolve), and says when more than one
product exists.

<Figure src="/img/desktop-ispcr.png" caption="The In-silico PCR dialog on hg19."/>

<Figure src="/img/desktop-ispcr-results.png" caption="A primer pair for TP53 exon 8 drawn as a read pair, facing inward across the product. The tick is a base that does not match the template."/>

## Notes

Result tracks store their features inline in the session, so they are kept as
long as the session is and saved with it. Each search adds another track; delete
the ones you are done with from the track selector.

## See also

- [](/docs/user_guides/sequence_search)
- [](/docs/user_guides/sequence_track)
