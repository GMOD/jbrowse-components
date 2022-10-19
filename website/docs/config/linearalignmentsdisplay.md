---
id: linearalignmentsdisplay
title: LinearAlignmentsDisplay
toplevel: true
---

has a "pileup" sub-display, where you can see individual reads and a
quantitative "snpcoverage" sub-display track showing SNP frequencies

#### slot: pileupDisplay

```js
/**
 * !slot
 */
pileupDisplay: pluginManager.getDisplayType('LinearPileupDisplay').configSchema
```

#### slot: snpCoverageDisplay

```js
/**
 * !slot
 */
snpCoverageDisplay: pluginManager.getDisplayType('LinearSNPCoverageDisplay')
  .configSchema
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: baseLinearDisplayConfigSchema
```
