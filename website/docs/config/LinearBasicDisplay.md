---
id: linearbasicdisplay
title: LinearBasicDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearBasicDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearBasicDisplay.md)

## Docs

configuration for the basic linear feature display (genes, BED, GFF, etc.)

Color slots are display-level: set them inside a track's `displays` array.
`color` is the main feature fill; use a plain CSS color, or a `jexl:` expression
to color per-feature. (`connectorColor` and `utrColor` set the intron lines and
UTR fill. The legacy `color1`/`color2`/`color3` names still work and map onto
these.)

```json
{
  "type": "FeatureTrack",
  "trackId": "my_genes",
  "name": "Genes",
  "assemblyNames": ["hg19"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "genes.gff.gz" },
  "displays": [
    {
      "type": "LinearBasicDisplay",
      "color": "blue",
      "utrColor": "lightblue"
    }
  ]
}
```

Color by an attribute with a jexl expression:

```json
{
  "type": "LinearBasicDisplay",
  "color": "jexl:get(feature,'type')=='gene'?'blue':'gray'"
}
```
