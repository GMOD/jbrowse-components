---
name: the-no-value-grey-has-a-dozen-spellings
description: About a dozen grey constants across plugins mean "neutral, no value, reference or rule", each a fixed light-theme value; a few named neutrals in palette.ts with dark counterparts would replace them. Waits on the merge list and captures.
---

# The no-value grey has a dozen spellings

Each constant below is a grey for one of a few meanings, picked locally and
fixed in both themes:

| Constant | Value | File |
| --- | --- | --- |
| `NO_CATEGORY_COLOR` | `#afafaf` | `packages/core/src/util/color/index.ts` |
| `MISCONFIGURED_COLOR` | `#808080` | `packages/core/src/util/color/index.ts` |
| `UNCOLORED_ROW` | `#999` | `plugins/wiggle/src/shared/wiggleColor.ts` |
| `REFERENCE_COLOR` | `#ccc` | `plugins/variants/src/shared/constants.ts` |
| `RIBBON_GREY` | `rgb(130,130,130)` | `plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/ribbonColorConfigSchema.ts` |
| `DEFAULT_RULE_COLOR` | `rgb(120,120,120)` | `packages/display-ui/src/yAxisConstants.ts` |
| transcript greys | `#c4c4c4`, `#9a9a9a`, `#777777` | `plugins/marks/src/LinearMultiRowFeatureDisplay/multiRowPlot.ts` |
| `FALLBACK_FILL` | `#aaaaaa` | `plugins/sequence/src/LinearReferenceSequenceDisplay/components/sequenceGeometry.ts` |
| `BORDER_COLOR` | `rgb(85,85,85)` | `plugins/sequence/src/LinearReferenceSequenceDisplay/components/sequenceMarks.ts` |
| `NO_RUNS` | `grey[400]` | `plugins/variants/src/VariantFeatureWidget/TandemRepeatPanel/TandemRepeatPanel.tsx` |

## Proposal

Name the meanings once in `palette.ts`, each with a dark value, and point the
constants at them:

- `noValue`: a category, row or feature with nothing to color by
  (`NO_CATEGORY_COLOR`, `UNCOLORED_ROW`, `RIBBON_GREY`, `NO_RUNS`);
- `referenceCell`: a call matching the reference (`REFERENCE_COLOR`);
- `rule`: an axis or baseline rule (`DEFAULT_RULE_COLOR`).

`MISCONFIGURED_COLOR` stays its own sentinel, since it says something different.
The multi-row transcript steps and the sequence track's two greys are a ramp and
a border, so they stay local unless a capture shows they clash with `noValue`.

## What deciding it involves

- the merge list above: which constants are truly the same statement;
- captures of each merged site, light and dark, since every merge shifts a value
  by up to 30 L*;
- worker-baked colors (`NO_CATEGORY_COLOR` ships in feature color arrays) need
  the dark value resolved on the main thread, as ADR-202 does for marks.

Related: `waiting-on-a-call/dark-theme-palette-gaps.md`, which lists the
variant reference cell too.
