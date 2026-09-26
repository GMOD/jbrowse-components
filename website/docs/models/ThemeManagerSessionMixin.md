---
id: thememanagersessionmixin
title: ThemeManagerSessionMixin
sidebar_label: Mixin -> ThemeManagerSessionMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/Themes.ts).

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-systemprefersdark">**systemPrefersDark**</span><br><code>systemPrefersDark: prefersDarkColorScheme()</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-themename">**themeName**</span><br><code>string</code> | Which palette is in effect. A stored name whose theme an admin has since dropped reads as `default` without the stored value being touched, so it comes back if the plugin supplying it loads again. |
| <span id="getter-thememode">**themeMode**</span><br><code>ThemeModeSelection</code> | Light, dark, or following the OS — the axis the palette is drawn along, and what the mode picker shows. `effectiveThemeMode` is the one to read for a colour decision. |
| <span id="getter-effectivethememode">**effectiveThemeMode**</span><br><code>PaletteMode</code> | Light or dark, with `system` resolved against the OS preference. |
| <span id="getter-themeisdark">**themeIsDark**</span><br><code>boolean</code> | Whether what is drawn right now is dark. Read off the resolved palette rather than the mode, so a palette pinned to one mode — an `extraThemes` entry declaring `mode: 'dark'` — answers for itself. |
| <span id="getter-themeoptions">**themeOptions**</span><br><code>SerializableThemeArgs</code> |  |
| <span id="getter-palette">**palette**</span><br><code>JBrowsePalette</code> | Every color JBrowse renders, resolved to plain strings. This is what rendering reads: it needs no React context, it crosses the RPC worker boundary as itself, and it costs no UI toolkit. Prefer it over `theme` anywhere the answer wanted is a color rather than a Material UI component style. |
| <span id="getter-styletheme">**styleTheme**</span><br><code>JBrowseStyleTheme</code> | The palette plus the sizing tokens `makeStyles` reads — spacing, corner radius, type scale. This is what a product mounts on `StyleThemeProvider`; it costs no UI toolkit, and it is derived from the same `themeOptions` as `theme`, so a config `theme` that sets `spacing` moves JBrowse's own styles and its Material components together. |
| <span id="getter-theme">**theme**</span><br><code>Theme</code> | The Material UI theme, for the components that are Material UI. Its palette is spliced from the same `resolvePalette` call as `palette` above, so the two cannot disagree. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-allthemes">**allThemes**</span><br><code>() =&gt; ThemeMap</code> |  |
| <span id="method-getactivethemeoptions">**getActiveThemeOptions**</span><br><code>(name?: string &#124; undefined) =&gt; ThemeOptions</code> | Raw `ThemeOptions` for the active theme, or a named override (used by the SVG-export theme picker). Unlike `theme` (a built, non-serializable MUI theme), this is the plain options object every view's SVG export threads into each display's `renderSvg`, which rebuilds the theme via `createJBrowseTheme` outside React context.<br><br>The `default` entry is merged with the config `theme` slot, because the picker labels it "Default (from config)" and `resolvePalette` merges the preset with the slot for every other consumer. The bare preset would make `view.exportSvg()` drop a host's configured palette: a config setting `primary.main` would draw `#123456` on screen and export the stock `#0D233F`, while the export dialog named the default theme. Every other named theme is a fixed preset that ignores config.<br><br>**The mode is spliced in here**, because a palette no longer carries one and this is the last point before the export leaves the session: every caller hands `renderSvg` these options and nothing else, so a figure exported from a dark session comes out dark. A palette pinned to its own mode, or a `name` from before the axis, states the mode itself and keeps it. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setthemename">**setThemeName**</span><br><code>(name: string) =&gt; void</code> | Pick a palette. A name from before light and dark were an axis sets the mode it spelled as well, so an old share link, a saved figure spec and `jbrowse-img --theme darkStock` all still mean what they said. |
| <span id="action-setsystemprefersdark">**setSystemPrefersDark**</span><br><code>(dark: boolean) =&gt; void</code> |  |
| <span id="action-stopfollowingsystemtheme">**stopFollowingSystemTheme**</span><br><code>() =&gt; void</code> | Leave `system` for the mode the OS is not asking for. The toolbar shows its theme control only while the session follows the system, so this is the one click out of a dark the OS handed someone who did not want it, and the control goes away with the following. The palette is untouched: a reader on Minimal who does this keeps Minimal. |
| <span id="action-setthememode">**setThemeMode**</span><br><code>(mode: ThemeModeSelection) =&gt; void</code> | Draw the session light or dark, leaving the palette alone. `system` follows the OS preference. Satisfies `ThemeModeSession`, so `useSessionPalette` works against an app session and an embedded one alike, and a host that follows its own dark-mode state calls this.<br><br>`themeOptions` carries the mode to the RPC worker, so the labels baked into a rendered image follow it along with what React draws. That used to take a write into the config `theme` slot, because mode lived inside a palette and there was nowhere else to put it. |
