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
| <span id="volatile-sessionthemename">**sessionThemeName**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>sessionThemeName: localStorageGetItem('themeName') ?? LIGHT_THE…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>sessionThemeName: localStorageGetItem('themeName') ?? LIGHT_THEME</code></pre></dialog></span> |  |
| <span id="volatile-systemprefersdark">**systemPrefersDark**</span><br><code>systemPrefersDark: prefersDarkColorScheme()</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-selectedthemename">**selectedThemeName**</span><br><code>string</code> | What the user picked, as the Preferences picker shows it: a name in `allThemes()`, or `system`. A stored name whose theme is no longer registered reads as `default` without the stored value being touched, so it comes back if the plugin supplying it loads again. |
| <span id="getter-themename">**themeName**</span><br><code>string</code> | The theme in effect: `selectedThemeName`, with `system` resolved against the OS preference. |
| <span id="getter-themeisdark">**themeIsDark**</span><br><code>boolean</code> | Whether what is drawn right now is dark. Read off the resolved palette, so an `extraThemes` entry declaring `mode: 'dark'` counts as dark alongside the two built-in dark presets. |
| <span id="getter-themeoptions">**themeOptions**</span><br><code>SerializableThemeArgs</code> |  |
| <span id="getter-palette">**palette**</span><br><code>JBrowsePalette</code> | Every color JBrowse renders, resolved to plain strings. This is what rendering reads: it needs no React context, it crosses the RPC worker boundary as itself, and it costs no UI toolkit. Prefer it over `theme` anywhere the answer wanted is a color rather than a Material UI component style. |
| <span id="getter-styletheme">**styleTheme**</span><br><code>JBrowseStyleTheme</code> | The palette plus the sizing tokens `makeStyles` reads — spacing, corner radius, type scale. This is what a product mounts on `StyleThemeProvider`; it costs no UI toolkit, and it is derived from the same `themeOptions` as `theme`, so a config `theme` that sets `spacing` moves JBrowse's own styles and its Material components together. |
| <span id="getter-theme">**theme**</span><br><code>Theme</code> | The Material UI theme, for the components that are Material UI. Its palette is spliced from the same `resolvePalette` call as `palette` above, so the two cannot disagree. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-allthemes">**allThemes**</span><br><code>() =&gt; ThemeMap</code> |  |
| <span id="method-getactivethemeoptions">**getActiveThemeOptions**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(name?: string &#124; undefined) =&gt; ThemeOptions &amp; { name?: string &#124;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(name?: string &#124; undefined) =&gt; ThemeOptions &amp; { name?: string &#124; undefined; }</code></pre></dialog></span> | Raw `ThemeOptions` for the active theme, or a named override (used by the SVG-export theme picker). Unlike `theme` (a built, non-serializable MUI theme), this is the plain options object every view's SVG export threads into each display's `renderSvg`, which rebuilds the theme via `createJBrowseTheme` outside React context.<br><br>The `default` entry is merged with the config `theme` slot, because the picker labels it "Default (from config)" and `resolvePalette` merges the preset with the slot for every other consumer. The bare preset would make `view.exportSvg()` drop a host's configured palette: a config setting `primary.main` would draw `#123456` on screen and export the stock `#0D233F`, while the export dialog named the default theme. Every other named theme is a fixed preset that ignores config. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setthemename">**setThemeName**</span><br><code>(name: string) =&gt; void</code> |  |
| <span id="action-setsystemprefersdark">**setSystemPrefersDark**</span><br><code>(dark: boolean) =&gt; void</code> |  |
| <span id="action-stopfollowingsystemtheme">**stopFollowingSystemTheme**</span><br><code>() =&gt; void</code> | Leave `system` for the mode the OS is not asking for. The whole of the toolbar's theme control: it shows only while the session follows the system, so this is the one click out of a dark the OS handed someone who did not want it, and the control goes away with the following. |
| <span id="action-setthememode">**setThemeMode**</span><br><code>(mode: "dark" &#124; "light") =&gt; void</code> | Point the session at light or dark, for a host that follows its own dark-mode state rather than offering JBrowse's theme menu. Satisfies `ThemeModeSession`, so `useSessionPalette` works against an app session and an embedded one alike.<br><br>Expressed as a write to the config `theme` slot plus a return to the `default` theme, not as `setThemeName('darkStock')`. Only the `default` theme merges `configTheme.palette` (see `resolvePalette`), so selecting a stock theme would discard whatever the host passed as `configuration.theme` — their brand `primary`, say — the first time their toggle fired. Merging at both levels for the same reason: `theme` is a frozen slot, and `mode` and `primary` are siblings under `palette`.<br><br>One write, not two: `themeOptions` is derived from the same slot and is what ships to the RPC worker, so the labels baked into a rendered image follow the mode along with what React draws. |
