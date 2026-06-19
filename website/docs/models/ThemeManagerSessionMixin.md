---
id: thememanagersessionmixin
title: ThemeManagerSessionMixin
sidebar_label: Mixin -> ThemeManagerSessionMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/Themes.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/ThemeManagerSessionMixin.md)

## Overview

<details open>
<summary>ThemeManagerSessionMixin - Volatiles</summary>

#### volatile: sessionThemeName

```ts
// type signature
type sessionThemeName = string
// code
sessionThemeName: localStorageGetItem('themeName') ?? 'default'
```

</details>

<details open>
<summary>ThemeManagerSessionMixin - Getters</summary>

#### getter: themeName

```ts
type themeName = string
```

#### getter: themeOptions

```ts
type themeOptions = SerializableThemeArgs
```

#### getter: theme

```ts
type theme = Theme
```

</details>

<details open>
<summary>ThemeManagerSessionMixin - Methods</summary>

#### method: allThemes

```ts
type allThemes = () => ThemeMap
```

</details>

<details open>
<summary>ThemeManagerSessionMixin - Actions</summary>

#### action: setThemeName

```ts
type setThemeName = (name: string) => void
```

</details>
