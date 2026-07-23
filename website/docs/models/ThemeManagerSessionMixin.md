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

## Members

| Member                                                 | Kind      | Defined by               | Description                                                                                         |
| ------------------------------------------------------ | --------- | ------------------------ | --------------------------------------------------------------------------------------------------- |
| [sessionThemeName](#volatile-sessionthemename)         | Volatiles | ThemeManagerSessionMixin |                                                                                                     |
| [themeName](#getter-themename)                         | Getters   | ThemeManagerSessionMixin |                                                                                                     |
| [themeOptions](#getter-themeoptions)                   | Getters   | ThemeManagerSessionMixin |                                                                                                     |
| [theme](#getter-theme)                                 | Getters   | ThemeManagerSessionMixin |                                                                                                     |
| [allThemes](#method-allthemes)                         | Methods   | ThemeManagerSessionMixin |                                                                                                     |
| [getActiveThemeOptions](#method-getactivethemeoptions) | Methods   | ThemeManagerSessionMixin | Raw `ThemeOptions` for the active theme, or a named override (used by the SVG-export theme picker). |
| [setThemeName](#action-setthemename)                   | Actions   | ThemeManagerSessionMixin |                                                                                                     |

<details>
<summary>ThemeManagerSessionMixin - Volatiles</summary>

| Member                                                       | Type     |
| ------------------------------------------------------------ | -------- |
| <span id="volatile-sessionthemename">sessionThemeName</span> | `string` |

</details>

<details>
<summary>ThemeManagerSessionMixin - Getters</summary>

| Member                                             | Type                    |
| -------------------------------------------------- | ----------------------- |
| <span id="getter-themename">themeName</span>       | `string`                |
| <span id="getter-themeoptions">themeOptions</span> | `SerializableThemeArgs` |
| <span id="getter-theme">theme</span>               | `Theme`                 |

</details>

<details>
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

| Member                                       | Type             |
| -------------------------------------------- | ---------------- |
| <span id="method-allthemes">allThemes</span> | `() => ThemeMap` |

</details>

<details>
<summary>ThemeManagerSessionMixin - Actions</summary>

| Member                                             | Type                     |
| -------------------------------------------------- | ------------------------ |
| <span id="action-setthemename">setThemeName</span> | `(name: string) => void` |

</details>
