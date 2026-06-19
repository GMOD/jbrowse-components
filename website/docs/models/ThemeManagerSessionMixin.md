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

<details>
<summary>ThemeManagerSessionMixin - Volatiles</summary>

#### volatile: sessionThemeName

```js
// type signature
string
// code
sessionThemeName: localStorageGetItem('themeName') ?? 'default'
```

</details>

<details>
<summary>ThemeManagerSessionMixin - Getters</summary>

#### getter: themeName

```js
// type
string
```

#### getter: themeOptions

```js
// type
SerializableThemeArgs
```

#### getter: theme

```js
// type
Theme
```

</details>

<details>
<summary>ThemeManagerSessionMixin - Methods</summary>

#### method: allThemes

```js
// type signature
allThemes: () => ThemeMap
```

</details>

<details>
<summary>ThemeManagerSessionMixin - Actions</summary>

#### action: setThemeName

```js
// type signature
setThemeName: (name: string) => void
```

</details>
