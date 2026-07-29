---
id: crisprguideadapter
title: CrisprGuideAdapter
sidebar_label: Adapter -> CrisprGuideAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `sequence`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/CrisprGuideAdapter/configSchema.ts).

Note: don't set `sequenceAdapter` — JBrowse supplies it from the assembly the
track is displayed against. Setting it by hand pins the scan to one sequence
source and silently desyncs the track if the assembly's sequence changes.

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "CrisprGuideAdapter", ... }`. Slot types (`fileLocation`,
`frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-sequenceadapter">**sequenceAdapter**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | discouraged: leave unset. JBrowse supplies the assembly's sequence adapter automatically; this override exists only for the rare case of scanning a sequence other than the one the track is displayed against. |
| <span id="slot-pam">**pam**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'NGG'</code> | PAM motif in IUPAC codes, e.g. NGG for SpCas9, TTTV for Cas12a |
| <span id="slot-guidelength">**guideLength**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>20</code> | protospacer length in bp |
| <span id="slot-pamlocation">**pamLocation**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (3prime, 5prime) = <code>'3prime'</code> | whether the PAM is 3' (Cas9) or 5' (Cas12a) of the protospacer |
| <span id="slot-cutoffset">**cutOffset**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>3</code> | distance in bp from the PAM-proximal end of the protospacer to the predicted cut site (3 for SpCas9) |
| <span id="slot-searchforward">**searchForward**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> |  |
| <span id="slot-searchreverse">**searchReverse**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> |  |
