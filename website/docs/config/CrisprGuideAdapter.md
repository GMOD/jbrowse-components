---
id: crisprguideadapter
title: CrisprGuideAdapter
sidebar_label: Adapter -> CrisprGuideAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `sequence`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/CrisprGuideAdapter/configSchema.ts).

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                     | Type                          | Description                                                                                          |
| ---------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| [sequenceAdapter](#slot-sequenceadapter) | `frozen`                      |                                                                                                      |
| [pam](#slot-pam)                         | `string`                      | PAM motif in IUPAC codes, e.g. NGG for SpCas9, TTTV for Cas12a                                       |
| [guideLength](#slot-guidelength)         | `number`                      | protospacer length in bp                                                                             |
| [pamLocation](#slot-pamlocation)         | `stringEnum` (3prime, 5prime) | whether the PAM is 3' (Cas9) or 5' (Cas12a) of the protospacer                                       |
| [cutOffset](#slot-cutoffset)             | `number`                      | distance in bp from the PAM-proximal end of the protospacer to the predicted cut site (3 for SpCas9) |
| [searchForward](#slot-searchforward)     | `boolean`                     |                                                                                                      |
| [searchReverse](#slot-searchreverse)     | `boolean`                     |                                                                                                      |

<details>
<summary>CrisprGuideAdapter - Slots</summary>

#### slot: sequenceAdapter

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:**
`null`

#### slot: pam

PAM motif in IUPAC codes, e.g. NGG for SpCas9, TTTV for Cas12a

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'NGG'`

#### slot: guideLength

protospacer length in bp

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `20`

#### slot: pamLocation

whether the PAM is 3' (Cas9) or 5' (Cas12a) of the protospacer

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`3prime`, `5prime`) · **Default:** `'3prime'`

#### slot: cutOffset

distance in bp from the PAM-proximal end of the protospacer to the predicted cut
site (3 for SpCas9)

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `3`

#### slot: searchForward

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: searchReverse

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

</details>
