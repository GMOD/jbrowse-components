---
id: thememanagersessionmixin
title: ThemeManagerSessionMixin
sidebar_label: Mixin -> ThemeManagerSessionMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/Themes.ts).

## Overview

<details>
<summary>ThemeManagerSessionMixin - Volatiles</summary>

#### volatile: sessionThemeName

```ts
// type signature
type sessionThemeName = string
// code
sessionThemeName: localStorageGetItem('themeName') ?? 'default'
```

</details>

<details>
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

#### method: getActiveThemeOptions

Raw `ThemeOptions` for the active theme, or a named override (used by the
SVG-export theme picker). Unlike `theme` (a built, non-serializable MUI theme),
this is the plain options object every view's SVG export threads into each
display's `renderSvg`, which rebuilds the theme via `createJBrowseTheme` outside
React context.

```ts
type getActiveThemeOptions = (
  name?: string | undefined,
) => ThemeOptions & { name?: string | undefined }
```

</details>

<details>
<summary>ThemeManagerSessionMixin - Methods (other undocumented members)</summary>

#### method: allThemes

```ts
type allThemes = () => ThemeMap
```

</details>

<details>
<summary>ThemeManagerSessionMixin - Actions</summary>

#### action: setThemeName

```ts
type setThemeName = (name: string) => void
```

</details>
