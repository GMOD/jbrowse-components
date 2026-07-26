---
id: ucscresultswidget
title: UcscResultsWidget
sidebar_label: Widget -> UcscResultsWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`blat` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/blat/src/UcscResultsWidget/stateModel.ts).

## Overview

The hit table for one UCSC BLAT or in-silico PCR query. The features are the
same ones the result track was built from, so the list and the track can't
disagree.

## Members

| Member                             | Kind       | Defined by        | Description                                                             |
| ---------------------------------- | ---------- | ----------------- | ----------------------------------------------------------------------- |
| [id](#property-id)                 | Properties | UcscResultsWidget |                                                                         |
| [type](#property-type)             | Properties | UcscResultsWidget |                                                                         |
| [features](#property-features)     | Properties | UcscResultsWidget | hits, best first (BLAT sorts by score; hgPcr returns products in order) |
| [assembly](#property-assembly)     | Properties | UcscResultsWidget | assembly the hits are on, for navigating and for the header line        |
| [trackName](#property-trackname)   | Properties | UcscResultsWidget | name of the on-the-fly track these hits were added as                   |
| [resultNoun](#property-resultnoun) | Properties | UcscResultsWidget | what one result is called.                                              |

<details>
<summary>UcscResultsWidget - Properties</summary>

#### property: features

hits, best first (BLAT sorts by score; hgPcr returns products in order)

```ts
// type signature
type features = IType<
  SimpleFeatureSerialized[] | null | undefined,
  SimpleFeatureSerialized[],
  SimpleFeatureSerialized[]
>
// code
features: types.frozen<SimpleFeatureSerialized[]>([])
```

#### property: assembly

assembly the hits are on, for navigating and for the header line

```ts
// type signature
type assembly = ISimpleType<string>
// code
assembly: types.string
```

#### property: trackName

name of the on-the-fly track these hits were added as

```ts
// type signature
type trackName = ISimpleType<string>
// code
trackName: types.string
```

#### property: resultNoun

what one result is called. A BLAT result is a hit; an hgPcr result is a product,
which is a band on a gel — the word a bench scientist reasons in, and "2 hits"
understates what two of them mean for a PCR run

```ts
// type signature
type resultNoun = IOptionalIType<ISimpleType<string>, [undefined]>
// code
resultNoun: types.optional(types.enumeration(['hit', 'product']), 'hit')
```

</details>

<details>
<summary>UcscResultsWidget - Properties (other undocumented members)</summary>

| Member                               | Type                               |
| ------------------------------------ | ---------------------------------- |
| <span id="property-id">id</span>     | `ISimpleType<string>`              |
| <span id="property-type">type</span> | `ISimpleType<"UcscResultsWidget">` |

</details>
