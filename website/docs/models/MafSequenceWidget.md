---
id: mafsequencewidget
title: MafSequenceWidget
sidebar_label: Widget -> MafSequenceWidget
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/MafSequenceWidget/stateModelFactory.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/MafSequenceWidget.md)

## Overview

Widget showing multiple-alignment (MAF) sequence for a set of samples over the
connected view's regions, with per-row hover highlight state.

<details open>
<summary>MafSequenceWidget - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                         | Signature                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`id`](#property-id)                           | `ISimpleType<string>`                                                                                                                                                                                                                                                                                                                 |
| [`type`](#property-type)                       | `ISimpleType<"MafSequenceWidget">`                                                                                                                                                                                                                                                                                                    |
| [`adapterConfig`](#property-adapterconfig)     | `IType<(ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) \| null \| undefined, (ModelInstanceTypeProps<...> & ... 1 more ... & IStateTreeNode<...>) \| undefined, (ModelInstanceType...` |
| [`samples`](#property-samples)                 | `IType<Sample[] \| null \| undefined, Sample[] \| undefined, Sample[] \| undefined>`                                                                                                                                                                                                                                                  |
| [`regions`](#property-regions)                 | `IType<{ refName: string; start: number; end: number; assemblyName: string; }[] \| null \| undefined, { refName: string; start: number; end: number; assemblyName: string; }[] \| undefined, { refName: string; start: number; end: number; assemblyName: string; }[] \| undefined>`                                                  |
| [`connectedViewId`](#property-connectedviewid) | `IMaybe<ISimpleType<string>>`                                                                                                                                                                                                                                                                                                         |

</details>

<details>
<summary>MafSequenceWidget - Properties (all signatures)</summary>

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

<details open>
<summary>MafSequenceWidget - Volatiles</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                       | Signature                     |
| -------------------------------------------- | ----------------------------- |
| [`hoverHighlight`](#volatile-hoverhighlight) | `HoverHighlight \| undefined` |

</details>

<details>
<summary>MafSequenceWidget - Volatiles (all signatures)</summary>

#### volatile: hoverHighlight

```ts
// type signature
type hoverHighlight = HoverHighlight | undefined
// code
hoverHighlight: undefined as HoverHighlight | undefined
```

</details>

<details open>
<summary>MafSequenceWidget - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                           | Signature                                          |
| ------------------------------------------------ | -------------------------------------------------- |
| [`setHoverHighlight`](#action-sethoverhighlight) | `(highlight: HoverHighlight \| undefined) => void` |

</details>

<details>
<summary>MafSequenceWidget - Actions (all signatures)</summary>

#### action: setHoverHighlight

```ts
type setHoverHighlight = (highlight: HoverHighlight | undefined) => void
```

</details>
