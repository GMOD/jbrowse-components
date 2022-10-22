---
id: linearalignmentsdisplay
title: LinearAlignmentsDisplay
toplevel: true
---

has a "pileup" sub-display, where you can see individual reads and a
quantitative "snpcoverage" sub-display track showing SNP frequencies

### Slots

#### slot: pileupDisplay

```js
pileupDisplay: pluginManager.getDisplayType('LinearPileupDisplay').configSchema
```

#### slot: snpCoverageDisplay

```js
snpCoverageDisplay: pluginManager.getDisplayType('LinearSNPCoverageDisplay')
  .configSchema
```

## Derives from

```js
baseConfiguration: baseLinearDisplayConfigSchema
```
