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

<details>
<summary>ChordVariantDisplay - Properties</summary>

#### property: type

```js
// type signature
ISimpleType<"ChordVariantDisplay">
// code
type: types.literal('ChordVariantDisplay')
```

#### property: bezierRadiusRatio

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
bezierRadiusRatio: types.stripDefault(types.number, 0.1)
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

</details>

<details>
<summary>ChordVariantDisplay - Volatiles</summary>

#### volatile: features

```js
// type signature
Feature[] | undefined
// code
features: undefined as Feature[] | undefined
```

#### volatile: refNameMap

```js
// type signature
Record<string, string> | undefined
// code
refNameMap: undefined as Record<string, string> | undefined
```

</details>

<details>
<summary>ChordVariantDisplay - Getters</summary>

#### getter: ready

```js
// type
boolean
```

#### getter: blocksForRefs

```js
// type
Record<string, Block>
```

#### getter: selectedFeatureId

```js
// type
string | undefined
```

</details>

<details>
<summary>ChordVariantDisplay - Methods</summary>

#### method: renderSvg

```js
// type signature
renderSvg: (_opts: ExportSvgOptions & { theme?: ThemeOptions | undefined; }) => Promise<Element | null>
```

</details>

<details>
<summary>ChordVariantDisplay - Actions</summary>

#### action: onChordClick

```js
// type signature
onChordClick: (feature: Feature) => void
```

#### action: setFeatures

```js
// type signature
setFeatures: (features: Feature[] | undefined) => void
```

#### action: setRefNameMap

```js
// type signature
setRefNameMap: (refNameMap: Record<string, string>) => void
```

</details>
