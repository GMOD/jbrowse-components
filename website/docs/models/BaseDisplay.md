---
id: basedisplay
title: BaseDisplay
sidebar_label: Display -> BaseDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/BaseDisplayModel.tsx).

## Overview

## Members

| Member                                                         | Kind       | Defined by  | Description                                                                                                                         |
| -------------------------------------------------------------- | ---------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [id](#property-id)                                             | Properties | BaseDisplay |                                                                                                                                     |
| [type](#property-type)                                         | Properties | BaseDisplay |                                                                                                                                     |
| [rpcDriverName](#property-rpcdrivername)                       | Properties | BaseDisplay |                                                                                                                                     |
| [ignorePromotedDefaults](#property-ignorepromoteddefaults)     | Properties | BaseDisplay | true for a display that arrived inside a session received from someone else (a share link, an encoded/json session, a `spec-` URL). |
| [error](#volatile-error)                                       | Volatiles  | BaseDisplay |                                                                                                                                     |
| [statusMessage](#volatile-statusmessage)                       | Volatiles  | BaseDisplay |                                                                                                                                     |
| [statusProgress](#volatile-statusprogress)                     | Volatiles  | BaseDisplay | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate.                 |
| [parentTrack](#getter-parenttrack)                             | Getters    | BaseDisplay |                                                                                                                                     |
| [parentDisplay](#getter-parentdisplay)                         | Getters    | BaseDisplay | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)    |
| [RenderingComponent](#getter-renderingcomponent)               | Getters    | BaseDisplay |                                                                                                                                     |
| [DisplayBlurb](#getter-displayblurb)                           | Getters    | BaseDisplay |                                                                                                                                     |
| [adapterConfig](#getter-adapterconfig)                         | Getters    | BaseDisplay |                                                                                                                                     |
| [isMinimized](#getter-isminimized)                             | Getters    | BaseDisplay | Returns true if the parent track is minimized.                                                                                      |
| [effectiveRpcDriverName](#getter-effectiverpcdrivername)       | Getters    | BaseDisplay | Returns the effective RPC driver name with hierarchical fallback: 1.                                                                |
| [DisplayMessageComponent](#getter-displaymessagecomponent)     | Getters    | BaseDisplay | if a display-level message should be displayed instead, make this return a react component                                          |
| [renderingProps](#method-renderingprops)                       | Methods    | BaseDisplay | props passed to the renderer's React "Rendering" component.                                                                         |
| [trackMenuItems](#method-trackmenuitems)                       | Methods    | BaseDisplay |                                                                                                                                     |
| [regionCannotBeRendered](#method-regioncannotberendered)       | Methods    | BaseDisplay |                                                                                                                                     |
| [setIgnorePromotedDefaults](#action-setignorepromoteddefaults) | Actions    | BaseDisplay | see the `ignorePromotedDefaults` property                                                                                           |
| [setStatusMessage](#action-setstatusmessage)                   | Actions    | BaseDisplay |                                                                                                                                     |
| [setError](#action-seterror)                                   | Actions    | BaseDisplay |                                                                                                                                     |
| [setRpcDriverName](#action-setrpcdrivername)                   | Actions    | BaseDisplay |                                                                                                                                     |
| [reload](#action-reload)                                       | Actions    | BaseDisplay | base display reload does nothing, see specialized displays for details                                                              |

<details>
<summary>BaseDisplay - Properties</summary>

#### property: ignorePromotedDefaults

true for a display that arrived inside a session received from someone else (a
share link, an encoded/json session, a `spec-` URL). Such a display resolves its
`promotable` config slots from its own config only, never from this browser's
promoted display-type defaults (see `configuration/promotableDefaults.ts`) — the
received session is a record of what the sender saw, and a local preference
silently repainting it would make it a lie. A track opened _afterwards_ in that
same session is a fresh track of this user's, so it never gets the flag and
picks up their defaults normally. Cleared by `resetSlotsToInherit` when the user
deliberately makes the display follow a default.

```ts
// type signature
type ignorePromotedDefaults = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
ignorePromotedDefaults: types.stripDefault(types.boolean, false)
```

</details>

<details>
<summary>BaseDisplay - Properties (other undocumented members)</summary>

| Member                                                 | Type                                               |
| ------------------------------------------------------ | -------------------------------------------------- |
| <span id="property-id">id</span>                       | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| <span id="property-type">type</span>                   | `ISimpleType<string>`                              |
| <span id="property-rpcdrivername">rpcDriverName</span> | `IMaybe<ISimpleType<string>>`                      |

</details>

<details>
<summary>BaseDisplay - Volatiles</summary>

#### volatile: statusProgress

determinate progress fraction [0,1] for the current status, or undefined when
the in-flight phase is indeterminate. Set alongside `statusMessage` by
`setStatusMessage`; a display that never shows a bar simply leaves it undefined.

```ts
// type signature
type statusProgress = number | undefined
// code
statusProgress: undefined as number | undefined
```

</details>

<details>
<summary>BaseDisplay - Volatiles (other undocumented members)</summary>

| Member                                                 | Type                  |
| ------------------------------------------------------ | --------------------- |
| <span id="volatile-error">error</span>                 | `unknown`             |
| <span id="volatile-statusmessage">statusMessage</span> | `string \| undefined` |

</details>

<details>
<summary>BaseDisplay - Getters</summary>

#### getter: parentDisplay

Returns the parent display if this display is nested within another display
(e.g., PileupDisplay inside LinearAlignmentsDisplay)

```ts
type parentDisplay =
  | { type?: string | undefined; effectiveRpcDriverName?: string | undefined }
  | undefined
```

#### getter: isMinimized

Returns true if the parent track is minimized. Used to skip expensive operations
like autoruns when track is not visible.

```ts
type isMinimized = boolean
```

#### getter: effectiveRpcDriverName

Returns the effective RPC driver name with hierarchical fallback:

1. This display's explicit rpcDriverName
2. Parent display's effectiveRpcDriverName (for nested displays)
3. Track config's rpcDriverName

```ts
type effectiveRpcDriverName = any
```

#### getter: DisplayMessageComponent

if a display-level message should be displayed instead, make this return a react
component

```ts
type DisplayMessageComponent = FC<any> | undefined
```

</details>

<details>
<summary>BaseDisplay - Getters (other undocumented members)</summary>

| Member                                                         | Type                                                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| <span id="getter-parenttrack">parentTrack</span>               | `AbstractTrackModel`                                                                            |
| <span id="getter-renderingcomponent">RenderingComponent</span> | `FC<…>`                                                                                         |
| <span id="getter-displayblurb">DisplayBlurb</span>             | `FC<{ model: ModelInstanceTypeProps<…> & { ...; } & { ...; } & IStateTreeNode<...>; }> \| null` |
| <span id="getter-adapterconfig">adapterConfig</span>           | `any`                                                                                           |

</details>

<details>
<summary>BaseDisplay - Methods</summary>

#### method: renderingProps

props passed to the renderer's React "Rendering" component. these are
client-side only and never sent to the worker. includes displayModel and
callbacks

```ts
type renderingProps = () => { displayModel: ModelInstanceTypeProps<…> & { ...; } & { ...; } & { ...; } & IStateTreeNode<...>; }
```

</details>

<details>
<summary>BaseDisplay - Methods (other undocumented members)</summary>

| Member                                                                 | Type               |
| ---------------------------------------------------------------------- | ------------------ |
| <span id="method-trackmenuitems">trackMenuItems</span>                 | `() => MenuItem[]` |
| <span id="method-regioncannotberendered">regionCannotBeRendered</span> | `() => null`       |

</details>

<details>
<summary>BaseDisplay - Actions</summary>

#### action: setIgnorePromotedDefaults

see the `ignorePromotedDefaults` property

```ts
type setIgnorePromotedDefaults = (flag: boolean) => void
```

#### action: reload

base display reload does nothing, see specialized displays for details

```ts
type reload = () => void
```

</details>

<details>
<summary>BaseDisplay - Actions (other undocumented members)</summary>

| Member                                                     | Type                                        |
| ---------------------------------------------------------- | ------------------------------------------- |
| <span id="action-setstatusmessage">setStatusMessage</span> | `(status?: RpcStatus \| undefined) => void` |
| <span id="action-seterror">setError</span>                 | `(error?: unknown) => void`                 |
| <span id="action-setrpcdrivername">setRpcDriverName</span> | `(rpcDriverName: string) => void`           |

</details>
