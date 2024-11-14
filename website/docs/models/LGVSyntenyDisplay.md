---
id: lgvsyntenydisplay
title: LGVSyntenyDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/linear-comparative-view/src/LGVSyntenyDisplay/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LGVSyntenyDisplay/model.ts)

displays location of "synteny" feature in a plain LGV, allowing linking out to
external synteny views

extends

- [SharedLinearPileupDisplayMixin](../sharedlinearpileupdisplaymixin)

### LGVSyntenyDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LGVSyntenyDisplay">
// code
type: types.literal('LGVSyntenyDisplay')
```

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(schema)
```

### LGVSyntenyDisplay - Methods

#### method: contextMenuItems

```js
// type signature
contextMenuItems: () => MenuItem[]
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

### LGVSyntenyDisplay - Actions

#### action: selectFeature

```js
// type signature
selectFeature: (feature: Feature) => void
```
