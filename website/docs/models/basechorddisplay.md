---
id: basechorddisplay
title: BaseChordDisplay
toplevel: true
---

extends `BaseDisplay`

#### property: bezierRadiusRatio

```js
bezierRadiusRatio: 0.1
```

#### property: assemblyName

```js
assemblyName: types.maybe(types.string)
```

#### action: onChordClick

```js
// Type signature
onChordClick: (feature: Feature) => void
```

#### getter: blockDefinitions

```js
// Type
any
```

#### getter: staticSlices

```js
// Type
any[]
```

#### method: renderProps

```js
// Type signature
renderProps: () => any
```

#### getter: radiusPx

```js
// Type
number
```

#### getter: rendererType

the pluggable element type object for this diplay's
renderer

```js
// Type
RendererType
```

#### method: isCompatibleWithRenderer

```js
// Type signature
isCompatibleWithRenderer: (renderer: RendererType) => boolean
```

#### getter: selectedFeatureId

returns a string feature ID if the globally-selected object
is probably a feature

```js
// Type
string
```

#### action: renderStarted

```js
// Type signature
renderStarted: () => void
```

#### action: renderSuccess

```js
// Type signature
renderSuccess: ({ message, data, reactElement, renderingComponent, }: { message: string; data: any; reactElement: React.ReactElement; renderingComponent: React.ComponentType<any>; }) => void
```

#### action: renderError

```js
// Type signature
renderError: (error: unknown) => void
```

#### action: setRefNameMap

```js
// Type signature
setRefNameMap: (refNameMap: Record<string, string>) => void
```

#### getter: parentTrack

```js
// Type
any
```

#### action: setError

```js
// Type signature
setError: (error?: unknown) => void
```

#### property: type

```js
type: types.literal('LinearVariantDisplay')
```

#### property: configuration

```js
configuration: ConfigurationReference(configSchema)
```

#### action: selectFeature

```js
// Type signature
selectFeature: (feature: Feature) => Promise<void>
```

#### getter: initialized

```js
// Type
any
```

#### action: setDisplayedRegions

```js
// Type signature
setDisplayedRegions: (regions: SnapshotOrInstance<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>>[]) => void
```

#### action: showTrack

```js
// Type signature
showTrack: (trackId: string, initialSnapshot?: {}) => void
```
