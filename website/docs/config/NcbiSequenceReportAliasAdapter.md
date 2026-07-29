---
id: ncbisequencereportaliasadapter
title: NcbiSequenceReportAliasAdapter
sidebar_label: Adapter -> NcbiSequenceReportAliasAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `config`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/NcbiSequenceReportAliasAdapter/configSchema.ts).

## Overview

can read "sequence_report.tsv" type files from NCBI

### NcbiSequenceReportAliasAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "NcbiSequenceReportAliasAdapter",
  "uri": "sequence_report.tsv"
}
```

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "NcbiSequenceReportAliasAdapter", ... }`. Slot types
(`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-location">**location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: '/path/to/my/sequence_report.tsv', locationType: 'UriLoc…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ uri: '/path/to/my/sequence_report.tsv', locationType: 'UriLocation' }</code></pre></dialog></span> |  |
| <span id="slot-usenameoverride">**useNameOverride**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | forces usage of the UCSC names over the NCBI style names from a FASTA |
