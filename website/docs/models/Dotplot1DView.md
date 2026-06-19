---
id: dotplot1dview
title: Dotplot1DView
sidebar_label: View -> Dotplot1DView
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/DotplotView/1dview.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/Dotplot1DView.md)

## Overview

ref https://@jbrowse/mobx-state-tree.js.org/concepts/volatiles on volatile state
used here

<details open>
<summary>Dotplot1DView - Getters</summary>

#### getter: dynamicBlocks

this uses padding=false and elision=false

```ts
type dynamicBlocks = BlockSet
```

#### getter: maxBpPerPx

```ts
type maxBpPerPx = number
```

#### getter: minBpPerPx

```ts
type minBpPerPx = number
```

#### getter: maxOffset

```ts
type maxOffset = number
```

#### getter: minOffset

```ts
type minOffset = number
```

</details>

<details open>
<summary>Dotplot1DView - Actions</summary>

#### action: center

```ts
type center = () => void
```

</details>
