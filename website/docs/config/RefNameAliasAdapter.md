---
id: refnamealiasadapter
title: RefNameAliasAdapter
sidebar_label: Adapter -> RefNameAliasAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `config`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/RefNameAliasAdapter/configSchema.ts).

## Overview

can read "chromAliases" type files from UCSC or any tab separated file of
refName aliases

### RefNameAliasAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "RefNameAliasAdapter",
  "uri": "yourfile.chromAlias.txt"
}
```

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "RefNameAliasAdapter", ... }`. It also accepts the
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`,
`baseUri` in place of writing a location slot out. Slot types (`fileLocation`,
`frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-location">**location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my/aliases.txt', locationType: 'UriLocation' }</code> |  |
| <span id="slot-refnamecolumn">**refNameColumn**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | by default, the "ref names that match the fasta" are assumed to be in the first column (0), change this variable if needed<br>_advanced_ |
| <span id="slot-refnamecolumnheadername">**refNameColumnHeaderName**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | refNameColumnHeaderName<br>_advanced_ |
