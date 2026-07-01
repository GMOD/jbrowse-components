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

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                           | Signature |
| ------------------------------------------------ | --------- |
| [`sessionThemeName`](#volatile-sessionthemename) | `string`  |

</details>

<details>
<summary>ThemeManagerSessionMixin - Volatiles (all signatures)</summary>

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

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                 | Signature               |
| -------------------------------------- | ----------------------- |
| [`themeName`](#getter-themename)       | `string`                |
| [`themeOptions`](#getter-themeoptions) | `SerializableThemeArgs` |
| [`theme`](#getter-theme)               | `Theme`                 |

</details>

<details>
<summary>ThemeManagerSessionMixin - Getters (all signatures)</summary>

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

#### method: getActiveThemeOptions

Raw `ThemeOptions` for the active theme, or a named override (used by the
SVG-export theme picker). Unlike `theme` (a built, non-serializable MUI theme),
this is the plain options object every view's SVG export threads into each
display's `renderSvg`, which rebuilds the theme via `createJBrowseTheme` outside
React context.

```ts
type getActiveThemeOptions = (
  name?: any,
) => ThemeOptions & { name?: string | undefined }
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                           | Signature        |
| -------------------------------- | ---------------- |
| [`allThemes`](#method-allthemes) | `() => ThemeMap` |

</details>

<details>
<summary>ThemeManagerSessionMixin - Methods (all signatures)</summary>

#### method: allThemes

```ts
type allThemes = () => ThemeMap
```

</details>

<details open>
<summary>ThemeManagerSessionMixin - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                 | Signature                |
| -------------------------------------- | ------------------------ |
| [`setThemeName`](#action-setthemename) | `(name: string) => void` |

</details>

<details>
<summary>ThemeManagerSessionMixin - Actions (all signatures)</summary>

#### action: setThemeName

```ts
type setThemeName = (name: string) => void
```

</details>
