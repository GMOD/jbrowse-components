---
id: highlightsmixin
title: HighlightsMixin
sidebar_label: Mixin -> HighlightsMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/HighlightsMixin.ts).

## Overview

The `view.highlight` band state shared verbatim by the LinearGenomeView and
DotplotView: an array of translucent highlight regions plus the
`showHighlightChips` toggle for their interactive chips. Both views compose this
so the props and actions stay identical by construction rather than by two
hand-kept copies. Visibility across all views is the session-wide
`highlightsVisible` flag (on BaseSession), not a prop here.

## Members

| Member                                                 | Kind       | Defined by      | Description                                                                                                                |
| ------------------------------------------------------ | ---------- | --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [highlight](#property-highlight)                       | Properties | HighlightsMixin | translucent highlight bands, seeded from URL params or session JSON and added interactively via the rubber-band menu       |
| [showHighlightChips](#property-showhighlightchips)     | Properties | HighlightsMixin | controls whether the interactive highlight chip (link icon + context menu) is drawn on each highlight band; off by default |
| [addToHighlights](#action-addtohighlights)             | Actions    | HighlightsMixin |                                                                                                                            |
| [setHighlight](#action-sethighlight)                   | Actions    | HighlightsMixin |                                                                                                                            |
| [removeHighlight](#action-removehighlight)             | Actions    | HighlightsMixin |                                                                                                                            |
| [updateHighlight](#action-updatehighlight)             | Actions    | HighlightsMixin |                                                                                                                            |
| [setShowHighlightChips](#action-setshowhighlightchips) | Actions    | HighlightsMixin |                                                                                                                            |

<details>
<summary>HighlightsMixin - Properties</summary>

#### property: highlight

translucent highlight bands, seeded from URL params or session JSON and added
interactively via the rubber-band menu

```ts
// type signature
type highlight = IOptionalIType<
  IArrayType<IType<HighlightType, HighlightType, HighlightType>>,
  [undefined]
>
// code
highlight: types.stripDefault(types.array(types.frozen<HighlightType>()), [])
```

#### property: showHighlightChips

controls whether the interactive highlight chip (link icon + context menu) is
drawn on each highlight band; off by default

```ts
// type signature
type showHighlightChips = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showHighlightChips: types.stripDefault(types.boolean, false)
```

</details>

<details>
<summary>HighlightsMixin - Actions</summary>

| Member                                                               | Type                                                            |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| <span id="action-addtohighlights">addToHighlights</span>             | `(highlight: HighlightType) => void`                            |
| <span id="action-sethighlight">setHighlight</span>                   | `(highlight?: HighlightType[] \| undefined) => void`            |
| <span id="action-removehighlight">removeHighlight</span>             | `(highlight: HighlightType) => void`                            |
| <span id="action-updatehighlight">updateHighlight</span>             | `(old: HighlightType, updates: Partial<HighlightType>) => void` |
| <span id="action-setshowhighlightchips">setShowHighlightChips</span> | `(arg: boolean) => void`                                        |

</details>
