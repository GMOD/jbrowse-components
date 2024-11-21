---
id: linearalignmentsdisplay
title: LinearAlignmentsDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts)

has a "pileup" sub-display, where you can see individual reads and a
quantitative "snpcoverage" sub-display track showing SNP frequencies

### LinearAlignmentsDisplay - Slots

#### slot: pileupDisplay

```js
pileupDisplay: pm.getDisplayType('LinearPileupDisplay')!.configSchema
```

#### slot: snpCoverageDisplay

```js
snpCoverageDisplay: pm.getDisplayType('LinearSNPCoverageDisplay')!
        .configSchema
```

#### slot: height

```js
height: {
        type: 'number',
        defaultValue: 250,
      }
```

### LinearAlignmentsDisplay - Derives from

```js
baseConfiguration: baseLinearDisplayConfigSchema
```
