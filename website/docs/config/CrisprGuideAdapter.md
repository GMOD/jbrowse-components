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
| <span id="slot-cutoffset">**cutOffset**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>3</code> | distance in bp from the PAM-proximal end of the protospacer to the cut on the protospacer-matching strand (3 for SpCas9, 18 for Cas12a) |
| <span id="slot-cutoffsetbottom">**cutOffsetBottom**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>3</code> | same, for the cut on the opposite strand. Equal to `cutOffset` for a blunt cutter like SpCas9; larger for a staggered one like Cas12a (23), whose two cuts leave a 5' overhang. |
| <span id="slot-mingcpercent">**minGcPercent**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | drop guides below this GC percent. A PAM occurs every ~8bp of genome, so an unfiltered scan is far denser than a display can draw; the defaults keep everything and leave the choice to the caller. |
| <span id="slot-maxgcpercent">**maxGcPercent**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | drop guides above this GC percent |
| <span id="slot-excludepolyt">**excludePolyT**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | drop guides containing TTTT, which terminates transcription from the pol III (U6/H1) promoters guides are usually expressed from |
| <span id="slot-searchforward">**searchForward**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | whether to scan the forward strand for PAMs |
| <span id="slot-searchreverse">**searchReverse**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | whether to scan the reverse strand for PAMs |
