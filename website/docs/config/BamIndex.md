---
id: bamindex
title: BamIndex
sidebar_label: Adapter -> BamIndex
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/bamIndexFields.ts).

Where a BAM's index is and which of the two kinds it is. `indexType` is
derived from the index file's own name where the config names a `.csi` and
leaves it unset, so the usual config states neither — the `uri` shorthand
derives both, and `csi: true` beside it switches the pair together. Spell
`location` out for an index that does not sit beside its BAM; a `.csi` named
there is read as a CSI without `indexType` as well.

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "BamIndex", ... }`. This adapter has no `uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-indextype">**indexType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (BAI, CSI) = <code>'BAI'</code> | `BAI` is the usual `samtools index` output. `CSI` is required for a reference longer than 512 Mb, which BAI cannot address. Derived from the index file name where the config names a `.csi` and leaves this unset. |
| <span id="slot-location">**location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.bam.bai', locationType: 'UriLocation' }</code> | location of the index. Only needed when it is not named `<file>.bam.bai` (or `.bam.csi`), the names the `uri` shorthand assumes. |
