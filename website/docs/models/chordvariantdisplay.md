---
id: chordvariantdisplay
title: ChordVariantDisplay
toplevel: true
---

extends `BaseChordDisplay`

#### property: type

```js
type: types.literal('ChordVariantDisplay')
```

#### property: configuration

```js
configuration: ConfigurationReference(configSchema)
```

#### getter: rendererTypeName

```js
// Type
any
```

#### method: renderProps

```js
// Type signature
renderProps: () => Record<string, unknown>
```

#### property: rpcDriverName

```js
self.rpcDriverName
```

#### property: bezierRadiusRatio

```js
self.bezierRadiusRatio
```

#### action: onChordClick

```js
// Type signature
onChordClick: (feature: Feature) => void
```
