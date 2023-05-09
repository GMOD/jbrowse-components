---
id: lgvsyntenydisplay
title: LGVSyntenyDisplay
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Source file

[plugins/linear-comparative-view/src/LGVSyntenyDisplay/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LGVSyntenyDisplay/model.ts)

## Docs

extends `LinearPileupDisplay`, displays location of "synteny" feature in a plain
LGV, allowing linking out to external synteny views

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
