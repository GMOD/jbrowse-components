---
id: chordvariantdisplay
title: ChordVariantDisplay
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

## Docs

extends

- [BaseDisplay](../basedisplay)

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

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseDisplay](../basedisplay)

**Properties:** id, type, rpcDriverName

**Getters:** parentTrack, parentDisplay, RenderingComponent, DisplayBlurb,
adapterConfig, isMinimized, effectiveRpcDriverName, effectiveTrackConfig,
rendererType, DisplayMessageComponent, viewMenuActions

**Methods:** renderProps, renderingProps, trackMenuItems, regionCannotBeRendered

**Actions:** setStatusMessage, setError, setRpcDriverName, reload

### ChordVariantDisplay - Properties

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
number
// code
bezierRadiusRatio: 0.1
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

### ChordVariantDisplay - Volatiles

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

### ChordVariantDisplay - Getters

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

### ChordVariantDisplay - Methods

#### method: renderSvg

```js
// type signature
renderSvg: (_opts: ExportSvgOptions & { theme?: ThemeOptions | undefined; }) => Promise<Element | null>
```

### ChordVariantDisplay - Actions

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
