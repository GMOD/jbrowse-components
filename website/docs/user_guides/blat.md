---
title: BLAT and in-silico PCR
description: Search a sequence against a genome and find primer amplicons
guide_category: Other features
---

The `blat` plugin adds two tools to the **Tools** menu that query UCSC-style
sequence-search servers: **BLAT search** and **In-silico PCR**. Both work
against hosted UCSC databases (or a self-hosted mirror/proxy) and add their hits
to the current view as a new track.

## BLAT search

Choose **Tools → BLAT search…**, then paste a DNA sequence (or FASTA) to align
it against the reference. Pick the UCSC genome database to search (e.g. `hg38`)
and submit; matches come back as feature results you can navigate to.

The UCSC BLAT server is length-limited, and public requests are gated behind a
CAPTCHA. You can either solve the CAPTCHA in the dialog, or paste a UCSC apiKey
(generate one from a UCSC Genome Browser account under Hub Development → API
key) to skip it. A proxy that injects a key server-side also avoids the CAPTCHA.

## In-silico PCR

Choose **Tools → In-silico PCR…** to find where a primer pair amplifies. Enter a
forward and reverse primer and an optional maximum product size; the predicted
amplicons are returned as a track. This uses UCSC's `hgPcr` service and follows
the same database-selection and apiKey/proxy options as BLAT search.

## See also

- [Sequence track](/docs/user_guides/sequence_track)
