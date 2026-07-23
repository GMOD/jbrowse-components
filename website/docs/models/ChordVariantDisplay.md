---
id: chordvariantdisplay
title: ChordVariantDisplay
sidebar_label: Display -> ChordVariantDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`circular-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/ChordVariantDisplay/models/stateModelFactory.ts).

## Example usage

The circular-view display for a `VariantTrack` of structural variants;
translocations are drawn as chords across the circle. `bezierRadiusRatio`
controls how far the chords bow toward the center:

```js
{
  type: 'VariantTrack',
  trackId: 'sv',
  name: 'Structural variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/sv.vcf.gz',
  },
  displays: [
    {
      type: 'ChordVariantDisplay',
      displayId: 'sv-ChordVariantDisplay',
      bezierRadiusRatio: 0.1,
    },
  ],
}
```

## Overview

## Members

| Member                                                         | Kind       | Defined by                    | Description                                                                                                                         |
| -------------------------------------------------------------- | ---------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                         | Properties | ChordVariantDisplay           |                                                                                                                                     |
| [bezierRadiusRatio](#property-bezierradiusratio)               | Properties | ChordVariantDisplay           |                                                                                                                                     |
| [configuration](#property-configuration)                       | Properties | ChordVariantDisplay           |                                                                                                                                     |
| [features](#volatile-features)                                 | Volatiles  | ChordVariantDisplay           |                                                                                                                                     |
| [refNameMap](#volatile-refnamemap)                             | Volatiles  | ChordVariantDisplay           |                                                                                                                                     |
| [view](#getter-view)                                           | Getters    | ChordVariantDisplay           |                                                                                                                                     |
| [ready](#getter-ready)                                         | Getters    | ChordVariantDisplay           |                                                                                                                                     |
| [svgReady](#getter-svgready)                                   | Getters    | ChordVariantDisplay           | Off-screen SVG export gate (see agent-docs/ARCHITECTURE.md, "svgReady").                                                            |
| [radiusPx](#getter-radiuspx)                                   | Getters    | ChordVariantDisplay           |                                                                                                                                     |
| [bezierRadius](#getter-bezierradius)                           | Getters    | ChordVariantDisplay           | how far chords bow toward the center                                                                                                |
| [blocksForRefs](#getter-blocksforrefs)                         | Getters    | ChordVariantDisplay           |                                                                                                                                     |
| [selectedFeatureId](#getter-selectedfeatureid)                 | Getters    | ChordVariantDisplay           |                                                                                                                                     |
| [renderSvg](#method-rendersvg)                                 | Methods    | ChordVariantDisplay           |                                                                                                                                     |
| [onChordClick](#action-onchordclick)                           | Actions    | ChordVariantDisplay           |                                                                                                                                     |
| [openErrorDialog](#action-openerrordialog)                     | Actions    | ChordVariantDisplay           |                                                                                                                                     |
| [setFeatures](#action-setfeatures)                             | Actions    | ChordVariantDisplay           |                                                                                                                                     |
| [setRefNameMap](#action-setrefnamemap)                         | Actions    | ChordVariantDisplay           |                                                                                                                                     |
| [id](#property-id)                                             | Properties | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [rpcDriverName](#property-rpcdrivername)                       | Properties | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [ignorePromotedDefaults](#property-ignorepromoteddefaults)     | Properties | [BaseDisplay](../basedisplay) | true for a display that arrived inside a session received from someone else (a share link, an encoded/json session, a `spec-` URL). |
| [error](#volatile-error)                                       | Volatiles  | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [statusMessage](#volatile-statusmessage)                       | Volatiles  | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [statusProgress](#volatile-statusprogress)                     | Volatiles  | [BaseDisplay](../basedisplay) | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate.                 |
| [parentTrack](#getter-parenttrack)                             | Getters    | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [parentDisplay](#getter-parentdisplay)                         | Getters    | [BaseDisplay](../basedisplay) | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)    |
| [RenderingComponent](#getter-renderingcomponent)               | Getters    | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [DisplayBlurb](#getter-displayblurb)                           | Getters    | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [adapterConfig](#getter-adapterconfig)                         | Getters    | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [isMinimized](#getter-isminimized)                             | Getters    | [BaseDisplay](../basedisplay) | Returns true if the parent track is minimized.                                                                                      |
| [effectiveRpcDriverName](#getter-effectiverpcdrivername)       | Getters    | [BaseDisplay](../basedisplay) | Returns the effective RPC driver name with hierarchical fallback: 1.                                                                |
| [DisplayMessageComponent](#getter-displaymessagecomponent)     | Getters    | [BaseDisplay](../basedisplay) | if a display-level message should be displayed instead, make this return a react component                                          |
| [renderingProps](#method-renderingprops)                       | Methods    | [BaseDisplay](../basedisplay) | props passed to the renderer's React "Rendering" component.                                                                         |
| [trackMenuItems](#method-trackmenuitems)                       | Methods    | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [regionCannotBeRendered](#method-regioncannotberendered)       | Methods    | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [setIgnorePromotedDefaults](#action-setignorepromoteddefaults) | Actions    | [BaseDisplay](../basedisplay) | see the `ignorePromotedDefaults` property                                                                                           |
| [setStatusMessage](#action-setstatusmessage)                   | Actions    | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [setError](#action-seterror)                                   | Actions    | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [setRpcDriverName](#action-setrpcdrivername)                   | Actions    | [BaseDisplay](../basedisplay) |                                                                                                                                     |
| [reload](#action-reload)                                       | Actions    | [BaseDisplay](../basedisplay) | base display reload does nothing, see specialized displays for details                                                              |

### ChordVariantDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/chordvariantdisplay).

<details>
<summary>ChordVariantDisplay - Properties</summary>

| Member                                                         | Type                                                  |
| -------------------------------------------------------------- | ----------------------------------------------------- |
| <span id="property-type">type</span>                           | `ISimpleType<"ChordVariantDisplay">`                  |
| <span id="property-bezierradiusratio">bezierRadiusRatio</span> | `IOptionalIType<ISimpleType<number>, [undefined]>`    |
| <span id="property-configuration">configuration</span>         | `IConfigurationReference<ConfigurationSchemaType<…>>` |

</details>

<details>
<summary>ChordVariantDisplay - Volatiles</summary>

| Member                                           | Type                                  |
| ------------------------------------------------ | ------------------------------------- |
| <span id="volatile-features">features</span>     | `Feature[] \| undefined`              |
| <span id="volatile-refnamemap">refNameMap</span> | `Record<string, string> \| undefined` |

</details>

<details>
<summary>ChordVariantDisplay - Getters</summary>

#### getter: svgReady

Off-screen SVG export gate (see agent-docs/ARCHITECTURE.md, "svgReady"). Chord
displays are non-rectangular (radial), so they keep a bespoke `<DisplayError>`
error UI instead of `SvgChrome`, but still expose `svgReady` + await it via the
shared `awaitSvgReady` — no inlined `when()`. No `regionTooLarge` state.

```ts
type svgReady = boolean
```

#### getter: bezierRadius

how far chords bow toward the center

```ts
type bezierRadius = number
```

</details>

<details>
<summary>ChordVariantDisplay - Getters (other undocumented members)</summary>

| Member                                                       | Type                                                                                                                                                                         |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="getter-view">view</span>                           | `ModelInstanceTypeProps<_OverrideProps<{ id: IOptionalIType<…>; displayName: IMaybe<…>; minimized: IOptionalIType<…>; }, { ...; }>> & ... 10 more ... & IStateTreeNode<...>` |
| <span id="getter-ready">ready</span>                         | `boolean`                                                                                                                                                                    |
| <span id="getter-radiuspx">radiusPx</span>                   | `number`                                                                                                                                                                     |
| <span id="getter-blocksforrefs">blocksForRefs</span>         | `Record<string, Block>`                                                                                                                                                      |
| <span id="getter-selectedfeatureid">selectedFeatureId</span> | `string \| undefined`                                                                                                                                                        |

</details>

<details>
<summary>ChordVariantDisplay - Methods</summary>

| Member                                       | Type                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| <span id="method-rendersvg">renderSvg</span> | `(_opts: ExportSvgOptions & { theme?: ThemeOptions \| undefined; }) => Promise<Element \| null>` |

</details>

<details>
<summary>ChordVariantDisplay - Actions</summary>

| Member                                                   | Type                                           |
| -------------------------------------------------------- | ---------------------------------------------- |
| <span id="action-onchordclick">onChordClick</span>       | `(feature: Feature) => void`                   |
| <span id="action-openerrordialog">openErrorDialog</span> | `() => void`                                   |
| <span id="action-setfeatures">setFeatures</span>         | `(features: Feature[] \| undefined) => void`   |
| <span id="action-setrefnamemap">setRefNameMap</span>     | `(refNameMap: Record<string, string>) => void` |

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from BaseDisplay</summary>

[BaseDisplay →](../basedisplay)

**Properties**

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

| Member                                                 | Type                                               |
| ------------------------------------------------------ | -------------------------------------------------- |
| <span id="property-id">id</span>                       | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| <span id="property-rpcdrivername">rpcDriverName</span> | `IMaybe<ISimpleType<string>>`                      |

**Volatiles**

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

| Member                                                 | Type                  |
| ------------------------------------------------------ | --------------------- |
| <span id="volatile-error">error</span>                 | `unknown`             |
| <span id="volatile-statusmessage">statusMessage</span> | `string \| undefined` |

**Getters**

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

| Member                                                         | Type                                                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| <span id="getter-parenttrack">parentTrack</span>               | `AbstractTrackModel`                                                                            |
| <span id="getter-renderingcomponent">RenderingComponent</span> | `FC<…>`                                                                                         |
| <span id="getter-displayblurb">DisplayBlurb</span>             | `FC<{ model: ModelInstanceTypeProps<…> & { ...; } & { ...; } & IStateTreeNode<...>; }> \| null` |
| <span id="getter-adapterconfig">adapterConfig</span>           | `any`                                                                                           |

**Methods**

#### method: renderingProps

props passed to the renderer's React "Rendering" component. these are
client-side only and never sent to the worker. includes displayModel and
callbacks

```ts
type renderingProps = () => { displayModel: ModelInstanceTypeProps<…> & { ...; } & { ...; } & { ...; } & IStateTreeNode<...>; }
```

| Member                                                                 | Type               |
| ---------------------------------------------------------------------- | ------------------ |
| <span id="method-trackmenuitems">trackMenuItems</span>                 | `() => MenuItem[]` |
| <span id="method-regioncannotberendered">regionCannotBeRendered</span> | `() => null`       |

**Actions**

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

| Member                                                     | Type                                        |
| ---------------------------------------------------------- | ------------------------------------------- |
| <span id="action-setstatusmessage">setStatusMessage</span> | `(status?: RpcStatus \| undefined) => void` |
| <span id="action-seterror">setError</span>                 | `(error?: unknown) => void`                 |
| <span id="action-setrpcdrivername">setRpcDriverName</span> | `(rpcDriverName: string) => void`           |

</details>
