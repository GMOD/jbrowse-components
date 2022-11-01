---
id: linearsyntenyview
title: LinearSyntenyView
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See [Core concepts and intro to pluggable
elements](/docs/developer_guide/) for more info

## Docs

extends the `LinearComparativeView` base model

### LinearSyntenyView - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearSyntenyView">
// code
type: types.literal('LinearSyntenyView')
```

#### property: drawCurves

```js
// type signature
false
// code
drawCurves: false
```

### LinearSyntenyView - Methods

#### method: menuItems

adds functions to draw curves and square the view

```js
// type signature
menuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

### LinearSyntenyView - Actions

#### action: toggleCurves

```js
// type signature
toggleCurves: () => void
```
