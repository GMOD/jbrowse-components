---
name: a-bigwig-raw-record-answers-its-min-and-max
description: The mark display's `y: 'maxScore'` over a BigWig draws nothing at the raw section, because @gmod/bbi's BigWigFeature answers `minScore`/`maxScore` as undefined on a raw record. The wiggle display reads a raw record's score for all three summaries; the bbi feature and the BigWig table should too.
---

# A BigWig raw record answers its min and max

The wiggle display's `y` picks a zoom bin's stored summary, `score`,
`minScore` or `maxScore`, and a raw record is its own bin: `featuresToRaw`
and `processFeaturesFromArrays` answer its score for all three
(WIGGLE_DISPLAY.md, "`y`, `extent`").

The mark display reads the same fields through `getFeatureTable`.
`wiggleRowsTable` (`plugins/wiggle/src/BigWigAdapter/bigWigFeatureTable.ts`)
declares `minScore` and `maxScore` only where the file summarizes, and a
MultiWiggle stack fills a raw member's rows with NaN, which `get` answers as
`undefined`. ADR-123 accepted that: "At the raw section those two answer
`undefined` and the encoder skips the row". So `y: 'maxScore'` draws data
zoomed out and nothing zoomed in.

`featureTable.test.ts` holds each table row to `BigWigFeature.get`, which
`@gmod/bbi`'s `ArrayFeatureView` answers `undefined` on a raw record. The
change is in bbi first (a raw record's `minScore`/`maxScore` is its score),
then the table drops the NaN fill and declares both lanes always, then
ADR-123's sentence is amended.
