---
id: linearvariantmatrixdisplay
title: LinearVariantMatrixDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/MultiLinearVariantMatrixDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearVariantMatrixDisplay.md)

## Docs

### LinearVariantMatrixDisplay - Slots

#### slot: renderer

MultiLinearVariantMatrixRenderer

```js
renderer: configSchema
```

#### slot: height

```js
height: {
        type: 'number',
        defaultValue: 250,
      }
```

#### slot: showReferenceAlleles

When true, reference alleles are drawn/colored. When false, the background is
solid grey and only ALT alleles are colored on top

```js
showReferenceAlleles: {
        type: 'boolean',
        defaultValue: false,
      }
```

#### slot: showSidebarLabels

```js
showSidebarLabels: {
        type: 'boolean',
        defaultValue: true,
      }
```

#### slot: showTree

```js
showTree: {
        type: 'boolean',
        defaultValue: true,
      }
```

#### slot: renderingMode

The rendering mode: 'alleleCount' shows dosage (darker color for homozygous),
'phased' splits samples into haplotype rows

```js
renderingMode: {
        type: 'stringEnum',
        model: types.enumeration('RenderingMode', ['alleleCount', 'phased']),
        defaultValue: 'alleleCount',
      }
```

#### slot: minorAlleleFrequencyFilter

Filter variants by minor allele frequency (0-1). Variants with MAF below this
threshold will be hidden

```js
minorAlleleFrequencyFilter: {
        type: 'number',
        defaultValue: 0,
      }
```

#### slot: colorBy

Automatically color samples by this metadata attribute when the track loads. The
attribute must be present in the sample metadata TSV file (configured via
samplesTsvLocation on the adapter). Leave empty to disable auto-coloring.

```js
colorBy: {
        type: 'string',
        defaultValue: '',
      }
```

### LinearVariantMatrixDisplay - Derives from

```js
baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager)
```
