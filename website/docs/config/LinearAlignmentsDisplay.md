---
id: linearalignmentsdisplay
title: LinearAlignmentsDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearAlignmentsDisplay.md)

## Docs

has a "pileup" sub-display, where you can see individual reads and a
quantitative "snpcoverage" sub-display track showing SNP frequencies extends

- [BaseLinearDisplay](../baselineardisplay)

### LinearAlignmentsDisplay - Slots

#### slot: pileupDisplay

```js
pileupDisplay: pluginManager.getDisplayType('LinearPileupDisplay')!
        .configSchema
```

#### slot: snpCoverageDisplay

```js
snpCoverageDisplay: pluginManager.getDisplayType(
        'LinearSNPCoverageDisplay',
      )!.configSchema
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
