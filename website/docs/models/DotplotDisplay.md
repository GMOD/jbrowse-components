---
id: dotplotdisplay
title: DotplotDisplay
sidebar_label: Display -> DotplotDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/DotplotDisplay/stateModelFactory.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/DotplotDisplay.md)

## Overview

### DotplotDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/dotplotdisplay).

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseDisplay](../basedisplay)

**Properties:** [id](../basedisplay#property-id),
[type](../basedisplay#property-type),
[rpcDriverName](../basedisplay#property-rpcdrivername)

**Volatiles:** [error](../basedisplay#volatile-error),
[statusMessage](../basedisplay#volatile-statusmessage)

**Getters:** [parentTrack](../basedisplay#getter-parenttrack),
[parentDisplay](../basedisplay#getter-parentdisplay),
[RenderingComponent](../basedisplay#getter-renderingcomponent),
[DisplayBlurb](../basedisplay#getter-displayblurb),
[adapterConfig](../basedisplay#getter-adapterconfig),
[isMinimized](../basedisplay#getter-isminimized),
[effectiveRpcDriverName](../basedisplay#getter-effectiverpcdrivername),
[effectiveTrackConfig](../basedisplay#getter-effectivetrackconfig),
[DisplayMessageComponent](../basedisplay#getter-displaymessagecomponent),
[viewMenuActions](../basedisplay#getter-viewmenuactions)

**Methods:** [renderProps](../basedisplay#method-renderprops),
[renderingProps](../basedisplay#method-renderingprops),
[trackMenuItems](../basedisplay#method-trackmenuitems),
[regionCannotBeRendered](../basedisplay#method-regioncannotberendered)

**Actions:** [setStatusMessage](../basedisplay#action-setstatusmessage),
[setError](../basedisplay#action-seterror),
[setRpcDriverName](../basedisplay#action-setrpcdrivername),
[reload](../basedisplay#action-reload)

<details open>
<summary>DotplotDisplay - Properties</summary>

#### property: colorBy

color by setting that overrides the config setting

```ts
// type signature
type colorBy = IOptionalIType<ISimpleType<string>, [undefined]>
// code
colorBy: types.optional(types.string, 'default')
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                               | Signature                                          |
| ---------------------------------------------------- | -------------------------------------------------- |
| [`type`](#property-type)                             | `ISimpleType<"DotplotDisplay">`                    |
| [`configuration`](#property-configuration)           | `ITypeUnion<any, any, any>`                        |
| [`alpha`](#property-alpha)                           | `IOptionalIType<ISimpleType<number>, [undefined]>` |
| [`minAlignmentLength`](#property-minalignmentlength) | `IOptionalIType<ISimpleType<number>, [undefined]>` |

</details>

<details>
<summary>DotplotDisplay - Properties (all signatures)</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'DotplotDisplay'>
// code
type: types.literal('DotplotDisplay')
```

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: alpha

```ts
// type signature
type alpha = IOptionalIType<ISimpleType<number>, [undefined]>
// code
alpha: types.optional(types.number, 1)
```

#### property: minAlignmentLength

```ts
// type signature
type minAlignmentLength = IOptionalIType<ISimpleType<number>, [undefined]>
// code
minAlignmentLength: types.optional(types.number, 0)
```

</details>

<details open>
<summary>DotplotDisplay - Volatiles</summary>

#### volatile: rpcData

RPC-computed feature data

```ts
// type signature
type rpcData = DotplotRpcData | undefined
// code
rpcData: undefined as DotplotRpcData | undefined
```

#### volatile: geometry

GPU-instance geometry produced from featPositions, self- describing via embedded
bpPerPx. The containing DotplotView aggregates one of these per display and
uploads them to the shared backend keyed by track index.

```ts
// type signature
type geometry = DotplotGeometryData | undefined
// code
geometry: undefined as DotplotGeometryData | undefined
```

#### volatile: statusProgress

determinate progress fraction [0,1] for the current status, or undefined when
the in-flight phase is indeterminate. Pairs with the `statusMessage` volatile
inherited from BaseDisplay.

```ts
// type signature
type statusProgress = number | undefined
// code
statusProgress: undefined as number | undefined
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                             | Signature                                |
| -------------------------------------------------- | ---------------------------------------- |
| [`fetchStopToken`](#volatile-fetchstoptoken)       | `StopToken \| undefined`                 |
| [`fetchWarnings`](#volatile-fetchwarnings)         | `{ message: string; effect: string; }[]` |
| [`assembliesSwapped`](#volatile-assembliesswapped) | `false`                                  |

</details>

<details>
<summary>DotplotDisplay - Volatiles (all signatures)</summary>

#### volatile: fetchStopToken

```ts
// type signature
type fetchStopToken = StopToken | undefined
// code
fetchStopToken: undefined as StopToken | undefined
```

#### volatile: fetchWarnings

```ts
// type signature
type fetchWarnings = { message: string; effect: string }[]
// code
fetchWarnings: [] as { message: string; effect: string }[]
```

#### volatile: assembliesSwapped

```ts
// type signature
type assembliesSwapped = false
// code
assembliesSwapped: false
```

</details>

<details open>
<summary>DotplotDisplay - Getters</summary>

#### getter: warnings

Per-render fetch warnings, plus the load-time reversed-assembly hint.

```ts
type warnings = { message: string; effect: string }[]
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                 | Signature |
| -------------------------------------- | --------- |
| [`isLoading`](#getter-isloading)       | `boolean` |
| [`isRefetching`](#getter-isrefetching) | `boolean` |

</details>

<details>
<summary>DotplotDisplay - Getters (all signatures)</summary>

#### getter: isLoading

```ts
type isLoading = boolean
```

#### getter: isRefetching

```ts
type isRefetching = boolean
```

</details>

<details open>
<summary>DotplotDisplay - Methods</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                           | Signature                                                                                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`renderSvg`](#method-rendersvg) | `(opts: ExportSvgOptions & { theme?: ThemeOptions \| undefined; }) => Promise<string \| number \| bigint \| boolean \| Iterable<ReactNode> \| Element \| null \| undefined>` |

</details>

<details>
<summary>DotplotDisplay - Methods (all signatures)</summary>

#### method: renderSvg

```ts
type renderSvg = (
  opts: ExportSvgOptions & { theme?: ThemeOptions | undefined },
) => Promise<
  | string
  | number
  | bigint
  | boolean
  | Iterable<ReactNode>
  | Element
  | null
  | undefined
>
```

</details>

<details open>
<summary>DotplotDisplay - Actions</summary>

#### action: setStatusMessage

Status callback for the in-flight fetch; derives the indeterminate message and
the determinate progress fraction. Overrides BaseDisplay's string-only setter so
the dotplot loading overlay can show a bar.

```ts
type setStatusMessage = (status?: RpcStatus | undefined) => void
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                   | Signature                                             |
| -------------------------------------------------------- | ----------------------------------------------------- |
| [`setLoading`](#action-setloading)                       | `(stopToken: StopToken) => void`                      |
| [`setRpcData`](#action-setrpcdata)                       | `(data: DotplotRpcData) => void`                      |
| [`setWarnings`](#action-setwarnings)                     | `(w: { message: string; effect: string; }[]) => void` |
| [`setAssembliesSwapped`](#action-setassembliesswapped)   | `(arg: boolean) => void`                              |
| [`setGeometry`](#action-setgeometry)                     | `(data: DotplotGeometryData \| undefined) => void`    |
| [`setError`](#action-seterror)                           | `(error: unknown) => void`                            |
| [`setAlpha`](#action-setalpha)                           | `(value: number) => void`                             |
| [`setMinAlignmentLength`](#action-setminalignmentlength) | `(value: number) => void`                             |
| [`setColorBy`](#action-setcolorby)                       | `(value: SyntenyColorBy) => void`                     |

</details>

<details>
<summary>DotplotDisplay - Actions (all signatures)</summary>

#### action: setLoading

```ts
type setLoading = (stopToken: StopToken) => void
```

#### action: setRpcData

```ts
type setRpcData = (data: DotplotRpcData) => void
```

#### action: setWarnings

```ts
type setWarnings = (w: { message: string; effect: string }[]) => void
```

#### action: setAssembliesSwapped

```ts
type setAssembliesSwapped = (arg: boolean) => void
```

#### action: setGeometry

```ts
type setGeometry = (data: DotplotGeometryData | undefined) => void
```

#### action: setError

```ts
type setError = (error: unknown) => void
```

#### action: setAlpha

```ts
type setAlpha = (value: number) => void
```

#### action: setMinAlignmentLength

```ts
type setMinAlignmentLength = (value: number) => void
```

#### action: setColorBy

```ts
type setColorBy = (value: SyntenyColorBy) => void
```

</details>
