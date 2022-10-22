---
id: linearalignmentsdisplay
title: LinearAlignmentsDisplay
toplevel: true
---

has a "pileup" sub-display, where you can see individual reads and a
quantitative "snpcoverage" sub-display track showing SNP frequencies

### LinearAlignmentsDisplay - Slots

#### slot: pileupDisplay

```js
pileupDisplay: pm.getDisplayType('LinearPileupDisplay').configSchema
```

#### slot: snpCoverageDisplay

```js
snpCoverageDisplay: pm.getDisplayType('LinearSNPCoverageDisplay').configSchema
```

## LinearAlignmentsDisplay - Derives from

```js
baseConfiguration: baseLinearDisplayConfigSchema
```
