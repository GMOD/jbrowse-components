---
id: linearalignmentsdisplay
title: LinearAlignmentsDisplay
toplevel: true
---

Note: this document is automatically generated from configuration objects in
our source code. See [Config guide](/docs/config_guide) for more info

## Docs

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
