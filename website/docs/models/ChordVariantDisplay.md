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

| Member                                           | Kind       | Description                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                           | Properties |                                                                                                                                                                                                                                                                                                                        |
| [bezierRadiusRatio](#property-bezierradiusratio) | Properties |                                                                                                                                                                                                                                                                                                                        |
| [configuration](#property-configuration)         | Properties |                                                                                                                                                                                                                                                                                                                        |
| [features](#volatile-features)                   | Volatiles  |                                                                                                                                                                                                                                                                                                                        |
| [refNameMap](#volatile-refnamemap)               | Volatiles  |                                                                                                                                                                                                                                                                                                                        |
| [ready](#getter-ready)                           | Getters    |                                                                                                                                                                                                                                                                                                                        |
| [svgReady](#getter-svgready)                     | Getters    | Off-screen SVG export gate (see agent-docs/ARCHITECTURE.md, "svgReady"). Chord displays are non-rectangular (radial), so they keep a bespoke `<DisplayError>` error UI instead of `SvgChrome`, but still expose `svgReady` + await it via the shared `awaitSvgReady` — no inlined `when()`. No `regionTooLarge` state. |
| [radiusPx](#getter-radiuspx)                     | Getters    |                                                                                                                                                                                                                                                                                                                        |
| [bezierRadius](#getter-bezierradius)             | Getters    | how far chords bow toward the center                                                                                                                                                                                                                                                                                   |
| [blocksForRefs](#getter-blocksforrefs)           | Getters    |                                                                                                                                                                                                                                                                                                                        |
| [selectedFeatureId](#getter-selectedfeatureid)   | Getters    |                                                                                                                                                                                                                                                                                                                        |
| [renderSvg](#method-rendersvg)                   | Methods    |                                                                                                                                                                                                                                                                                                                        |
| [onChordClick](#action-onchordclick)             | Actions    |                                                                                                                                                                                                                                                                                                                        |
| [openErrorDialog](#action-openerrordialog)       | Actions    |                                                                                                                                                                                                                                                                                                                        |
| [setFeatures](#action-setfeatures)               | Actions    |                                                                                                                                                                                                                                                                                                                        |
| [setRefNameMap](#action-setrefnamemap)           | Actions    |                                                                                                                                                                                                                                                                                                                        |

### ChordVariantDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/chordvariantdisplay).

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseDisplay](../basedisplay)

**Properties:** [id](../basedisplay#property-id),
[type](../basedisplay#property-type),
[rpcDriverName](../basedisplay#property-rpcdrivername)

**Volatiles:** [error](../basedisplay#volatile-error),
[statusMessage](../basedisplay#volatile-statusmessage),
[statusProgress](../basedisplay#volatile-statusprogress)

**Getters:** [parentTrack](../basedisplay#getter-parenttrack),
[parentDisplay](../basedisplay#getter-parentdisplay),
[RenderingComponent](../basedisplay#getter-renderingcomponent),
[DisplayBlurb](../basedisplay#getter-displayblurb),
[adapterConfig](../basedisplay#getter-adapterconfig),
[isMinimized](../basedisplay#getter-isminimized),
[effectiveRpcDriverName](../basedisplay#getter-effectiverpcdrivername),
[DisplayMessageComponent](../basedisplay#getter-displaymessagecomponent),
[viewMenuActions](../basedisplay#getter-viewmenuactions)

**Methods:** [renderingProps](../basedisplay#method-renderingprops),
[trackMenuItems](../basedisplay#method-trackmenuitems),
[regionCannotBeRendered](../basedisplay#method-regioncannotberendered)

**Actions:** [setStatusMessage](../basedisplay#action-setstatusmessage),
[setError](../basedisplay#action-seterror),
[setRpcDriverName](../basedisplay#action-setrpcdrivername),
[reload](../basedisplay#action-reload)

<details>
<summary>ChordVariantDisplay - Properties</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'ChordVariantDisplay'>
// code
type: types.literal('ChordVariantDisplay')
```

#### property: bezierRadiusRatio

```ts
// type signature
type bezierRadiusRatio = IOptionalIType<ISimpleType<number>, [undefined]>
// code
bezierRadiusRatio: types.stripDefault(types.number, 0.1)
```

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

</details>

<details>
<summary>ChordVariantDisplay - Volatiles</summary>

#### volatile: features

```ts
// type signature
type features = Feature[] | undefined
// code
features: undefined as Feature[] | undefined
```

#### volatile: refNameMap

```ts
// type signature
type refNameMap = Record<string, string> | undefined
// code
refNameMap: undefined as Record<string, string> | undefined
```

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

#### getter: ready

```ts
type ready = boolean
```

#### getter: radiusPx

```ts
type radiusPx = number
```

#### getter: blocksForRefs

```ts
type blocksForRefs = Record<string, Block>
```

#### getter: selectedFeatureId

```ts
type selectedFeatureId = string | undefined
```

</details>

<details>
<summary>ChordVariantDisplay - Methods</summary>

#### method: renderSvg

```ts
type renderSvg = (
  _opts: ExportSvgOptions & { theme?: ThemeOptions | undefined },
) => Promise<Element | null>
```

</details>

<details>
<summary>ChordVariantDisplay - Actions</summary>

#### action: onChordClick

```ts
type onChordClick = (feature: Feature) => void
```

#### action: openErrorDialog

```ts
type openErrorDialog = () => void
```

#### action: setFeatures

```ts
type setFeatures = (features: Feature[] | undefined) => void
```

#### action: setRefNameMap

```ts
type setRefNameMap = (refNameMap: Record<string, string>) => void
```

</details>
