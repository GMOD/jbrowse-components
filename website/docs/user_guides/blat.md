---
title: BLAT and in-silico PCR
description: Search a sequence against a genome and find primer amplicons
guide_category: Other features
---

**TL;DR:** The `blat` plugin adds two **Tools** menu items that query UCSC-style
sequence-search servers, **BLAT search** and **In-silico PCR**. Both run against
hosted UCSC databases (or a self-hosted mirror/proxy) and add their hits to the
current view as a new track.

## BLAT search

Choose **Tools → BLAT search…**, then paste a DNA sequence (or FASTA) to align
it against the reference. Pick the UCSC genome database to search (e.g. `hg38`)
and submit; matches come back as feature results you can navigate to.

The UCSC BLAT server is length-limited, and public requests are gated behind a
CAPTCHA. You can either solve the CAPTCHA in the dialog, or paste a UCSC apiKey
(generate one from a UCSC Genome Browser account under Hub Development → API
key) to skip it. A proxy that injects a key server-side also avoids the CAPTCHA.

<Figure src="/img/desktop-blat-search.png" caption="The BLAT search dialog on hg19. Paste a DNA sequence or FASTA and pick the assembly; 'Show advanced settings' reveals the UCSC database, server URL, and apiKey field."/>

## In-silico PCR

Choose **Tools → In-silico PCR…** to find where a primer pair amplifies. Enter a
forward and reverse primer and an optional maximum product size; the predicted
amplicons are returned as a track. This uses UCSC's `hgPcr` service and follows
the same database-selection and apiKey/proxy options as BLAT search.

<Figure src="/img/desktop-ispcr.png" caption="The In-silico PCR dialog on hg19. Forward and reverse primer fields with a max product size, sharing the same assembly picker and advanced apiKey/proxy options as BLAT search."/>

## See also

- [Sequence track](/docs/user_guides/sequence_track)
