---
name: sequence-panel-default-transcript-matches-the-track
description: A real bug. The sequence panel's default transcript claims to match the isoform the gene glyph collapses to, but ignores canonicalTranscriptTags, ranks coding isoforms by span rather than coding length, and breaks a tie toward the earlier isoform, so the panel can open on a different isoform from the one the track draws.
---

# The sequence panel's default transcript matches the track

`pickDefaultTranscriptIndex`
(`packages/core/src/BaseFeatureWidget/SequenceFeatureDetails/featureTypeUtil.ts`)
says it picks the transcript `longestCoding` collapses to. Canvas's
`rankIsoforms` (`plugins/canvas/src/RenderFeatureDataRPC/glyphs/subfeatures.ts`)
ranks differently in three ways:

- a `canonicalTranscriptTags` match (MANE Select, RefSeq Select) outranks
  every measurement, and the panel never reads the tags;
- a coding isoform is sized by its coding length, while the panel uses its span;
- an equal-size tie goes to the later isoform, while `reduce` keeps the
  earlier one.

A MANE-tagged gene whose longest isoform is a minor variant shows the
difference. The track collapses to the MANE transcript, and the panel opens on
the longest.

The fix is one ranking both sides call. Core cannot import the canvas plugin,
so the ranking moves into core and canvas imports it. The panel then needs the
track's `canonicalTranscriptField` and tags, which the feature widget would
have to be handed, since it reads a serialized feature with no display config.

Found by the 2026-10-02 plugins/canvas review.
