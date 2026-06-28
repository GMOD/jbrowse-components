---
id: chordvariantdisplay
title: ChordVariantDisplay
sidebar_label: Display -> ChordVariantDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/ChordVariantDisplay/models/stateModelFactory.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/ChordVariantDisplay.md)

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

<details open>
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

<details open>
<summary>ChordVariantDisplay - Getters</summary>

#### getter: ready

```ts
type ready = boolean
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

<details open>
<summary>ChordVariantDisplay - Methods</summary>

#### method: renderSvg

```ts
type renderSvg = (
  _opts: ExportSvgOptions & { theme?: ThemeOptions | undefined },
) => Promise<Element | null>
```

</details>

<details open>
<summary>ChordVariantDisplay - Actions</summary>

#### action: onChordClick

```ts
type onChordClick = (feature: Feature) => void
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
