---
id: lgvsyntenydisplay
title: LGVSyntenyDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LGVSyntenyDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LGVSyntenyDisplay.md)

## Docs

displays location of "synteny" feature in a plain LGV, allowing linking out to
external synteny views

extends

- [LinearAlignmentsDisplay](../linearalignmentsdisplay)

### LGVSyntenyDisplay - Properties

#### propertie: type

```js
// type signature
ISimpleType<"LGVSyntenyDisplay">
// code
type: types.literal('LGVSyntenyDisplay')
```

#### propertie: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(schema)
```

### LGVSyntenyDisplay - Methods

#### method: contextMenuItems

```js
// type signature
contextMenuItems: () => ({ label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; } | { label: string; onClick: () => void; icon?: undefined; })[]
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => ({ label: string; type: "subMenu"; subMenu: ({ label: "Normal" | "Compact" | "Super-compact"; type: "radio"; checked: boolean; onClick: () => void; } | { label: string; onClick: () => void; })[]; } | { ...; } | { ...; })[]
```

### LGVSyntenyDisplay - Actions

#### action: selectFeature

```js
// type signature
selectFeature: (feature: Feature) => void
```
