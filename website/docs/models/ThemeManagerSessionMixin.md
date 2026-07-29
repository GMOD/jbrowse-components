---
id: thememanagersessionmixin
title: ThemeManagerSessionMixin
sidebar_label: Mixin -> ThemeManagerSessionMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/Themes.ts).

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-sessionthemename">**sessionThemeName**</span><br><code>sessionThemeName: localStorageGetItem('themeName') ?? 'default'</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-themename">**themeName**</span><br><code>string</code> |  |
| <span id="getter-themeoptions">**themeOptions**</span><br><code>SerializableThemeArgs</code> |  |
| <span id="getter-theme">**theme**</span><br><code>Theme</code> |  |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-allthemes">**allThemes**</span><br><code>() =&gt; ThemeMap</code> |  |
| <span id="method-getactivethemeoptions">**getActiveThemeOptions**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(name?: string &#124; undefined) =&gt; ThemeOptions &amp; { name?: string &#124;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(name?: string &#124; undefined) =&gt; ThemeOptions &amp; { name?: string &#124; undefined; }</code></pre></dialog></span> | Raw `ThemeOptions` for the active theme, or a named override (used by the SVG-export theme picker). Unlike `theme` (a built, non-serializable MUI theme), this is the plain options object every view's SVG export threads into each display's `renderSvg`, which rebuilds the theme via `createJBrowseTheme` outside React context. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setthemename">**setThemeName**</span><br><code>(name: string) =&gt; void</code> |  |
