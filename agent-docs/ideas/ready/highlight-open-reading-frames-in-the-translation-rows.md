---
name: highlight-open-reading-frames-in-the-translation-rows
description: The reference sequence display's translation rows color each codon start, stop or plain, but never draw the start-to-stop span a reader scans six frames to find. A per-frame scan and one more mark over those rows would.
---

# Highlight open reading frames in the translation rows

The translation rows of `LinearReferenceSequenceDisplay` classify every codon
(`readCodon` in `sequenceGeometry.ts`), so a reader sees isolated starts and
stops. The unit they are looking for is the ORF between them, and today they
pair the two by eye across a row that may run off screen.

A scan per frame over the fetched region gives `[start, stop)` spans, and a
further mark over the translation rows draws the ones above a minimum length,
with a `minOrfLength` slot setting it. An ORF whose start or stop lies outside
the fetched region has no honest extent, so it draws open on that side or not
at all; that is the decision to make first.
