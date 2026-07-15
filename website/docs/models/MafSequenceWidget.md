---
id: mafsequencewidget
title: MafSequenceWidget
sidebar_label: Widget -> MafSequenceWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`maf` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/MafSequenceWidget/stateModelFactory.ts).

## Overview

Widget showing multiple-alignment (MAF) sequence for a set of samples over the
connected view's regions, with per-row hover highlight state.

## Members

| Member                                         | Kind       | Defined by        | Description |
| ---------------------------------------------- | ---------- | ----------------- | ----------- |
| [id](#property-id)                             | Properties | MafSequenceWidget |             |
| [type](#property-type)                         | Properties | MafSequenceWidget |             |
| [adapterConfig](#property-adapterconfig)       | Properties | MafSequenceWidget |             |
| [samples](#property-samples)                   | Properties | MafSequenceWidget |             |
| [regions](#property-regions)                   | Properties | MafSequenceWidget |             |
| [connectedViewId](#property-connectedviewid)   | Properties | MafSequenceWidget |             |
| [hoverHighlight](#volatile-hoverhighlight)     | Volatiles  | MafSequenceWidget |             |
| [setHoverHighlight](#action-sethoverhighlight) | Actions    | MafSequenceWidget |             |

<details>
<summary>MafSequenceWidget - Properties</summary>

#### property: id

```ts
// type signature
type id = ISimpleType<string>
// code
id: types.identifier
```

#### property: type

```ts
// type signature
type type = ISimpleType<'MafSequenceWidget'>
// code
type: types.literal('MafSequenceWidget')
```

#### property: adapterConfig

```ts
// type signature
type adapterConfig = IType<(ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) | null | undefined, (ModelInstanceTypeProps<...> & ... 1 more ... & IStateTreeNode<...>) | undefined, (ModelInstanceType...
// code
adapterConfig: types.frozen<AnyConfigurationModel | undefined>(undefined)
```

#### property: samples

```ts
// type signature
type samples = IType<
  Sample[] | null | undefined,
  Sample[] | undefined,
  Sample[] | undefined
>
// code
samples: types.frozen<Sample[] | undefined>(undefined)
```

#### property: regions

```ts
// type signature
type regions = IType<
  | { refName: string; start: number; end: number; assemblyName: string }[]
  | null
  | undefined,
  | { refName: string; start: number; end: number; assemblyName: string }[]
  | undefined,
  | { refName: string; start: number; end: number; assemblyName: string }[]
  | undefined
>
// code
regions: types.frozen<
  | {
      refName: string
      start: number
      end: number
      assemblyName: string
    }[]
  | undefined
>(undefined)
```

#### property: connectedViewId

```ts
// type signature
type connectedViewId = IMaybe<ISimpleType<string>>
// code
connectedViewId: types.maybe(types.string)
```

</details>

<details>
<summary>MafSequenceWidget - Volatiles</summary>

#### volatile: hoverHighlight

```ts
// type signature
type hoverHighlight = HoverHighlight | undefined
// code
hoverHighlight: undefined as HoverHighlight | undefined
```

</details>

<details>
<summary>MafSequenceWidget - Actions</summary>

#### action: setHoverHighlight

```ts
type setHoverHighlight = (highlight: HoverHighlight | undefined) => void
```

</details>
