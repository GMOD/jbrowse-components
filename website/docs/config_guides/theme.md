---
title: Coloring/theming
description:
  Customizing the application color theme, logo, and the user-preference
  defaults an instance ships with
guide_category: Appearance
---

Set colors and sizing under a top-level `theme` in the
[`configuration`](/docs/config/jbrowseconfiguration) section. JBrowse's palette
has four customizable colors (`primary`, `secondary`, `tertiary`, `quaternary`),
and a `dark` block for whatever a palette wants different when drawn dark.
`configuration.preferences` sets the starting value of the settings users can
toggle for themselves.

## Color

`theme` takes a MUI palette plus `typography` and `spacing`. `tertiary` and
`quaternary` are JBrowse extensions to the standard MUI palette, which has only
`primary` and `secondary`:

```json
{
  "configuration": {
    "theme": {
      "palette": {
        "primary": { "main": "#311b92" },
        "secondary": { "main": "#0097a7" },
        "tertiary": { "main": "#f57c00" },
        "quaternary": { "main": "#d50000" }
      },
      "typography": { "fontSize": 10 },
      "spacing": 2
    }
  }
}
```

<Figure src="/img/default_theme.png" caption="Example screenshot showing the default theme"/>

<Figure src="/img/customized_theme.png" caption="Example screenshot showing the customized theme"/>

## Light and dark

A palette and its light/dark setting are two separate things in Preferences. The
theme picker chooses colors — Default (from config), Stock, Minimal, or any
`extraThemes` entry — and a second control chooses Light, Dark or Follow system.
Moving one leaves the other alone, so a reader on Minimal who switches to dark
gets dark Minimal, and the colors you set under `theme` above apply in both.

Sessions start on Light, so a reader reaches dark by asking for it. Picking
Follow system puts a sun or moon in the toolbar naming the mode the OS landed
on; clicking it settles on the other one.

Most of a dark theme follows from the setting: the backgrounds, text, dividers,
gridlines, coverage and hover colors all have dark values already. What does not
survive the flip is a brand color — a deep navy that reads well on white is
nearly invisible on a dark background — so a palette may state the slots it
wants different when drawn dark:

```json
{
  "configuration": {
    "extraThemes": {
      "myTheme": {
        "name": "My theme",
        "palette": {
          "primary": { "main": "#311b92" },
          "dark": { "primary": { "main": "#9a86e0" } }
        }
      }
    }
  }
}
```

State `"mode": "dark"` in a palette instead and it is a dark-only theme: the
light/dark control no longer applies to it, because the light colors were never
written. In the top-level `theme` the same key is the instance's starting mode,
which a reader's own choice overrides.

## Extra themes

`extraThemes` entries join Stock and Minimal in the Preferences theme picker,
each with the same palette keys as the top-level `theme` above. `name` is the
row the user sees:

```json
{
  "configuration": {
    "extraThemes": {
      "myTheme": {
        "name": "My theme",
        "palette": { "primary": { "main": "#311b92" } }
      }
    }
  }
}
```

## Logo

`logoPath` replaces the JBrowse 2 logo in the top right corner with an SVG from
your server:

```json
{
  "configuration": {
    "logoPath": { "uri": "path/to/my/custom-logo.svg" }
  }
}
```

The logo fills the toolbar height and keeps its aspect ratio up to 150px wide,
so a wide, short logo (roughly 3:1) fills the space best.

## User preference defaults

`configuration.preferences` sets the starting value of each setting in the
Preferences dialog. A user's own choice is stored in `localStorage` and wins
from then on, so these are defaults for your instance, not a lock:

```json
{
  "configuration": {
    "preferences": {
      "numberGrouping": false,
      "scrollZoom": true,
      "useWorkspaces": true,
      "animationMode": "system"
    }
  }
}
```

[](/docs/config/preferencesconfigschema) lists each slot. A session that names
`useWorkspaces` itself still wins over the preference.

## Advanced

JBrowse themes through
[Material-UI](https://mui.com/material-ui/customization/theming/), so most
[`createTheme`](https://mui.com/material-ui/customization/theming/#createtheme-options-args-theme)
options work in the config. Style overrides that need callback functions come
from a plugin instead; the volvox
[`umd_plugin.js`](https://github.com/GMOD/jbrowse-components/blob/main/test_data/volvox/umd_plugin.js)
adds a theme that way, and the
[no-build plugin guide](/docs/developer_guides/no_build_plugin) shows how to
load one.

## See also

- [Theming (developer guide)](/docs/developer_guides/theming)
- [JBrowseConfiguration config docs](/docs/config/jbrowseconfiguration)
- [Configuring plugins](/docs/config_guides/plugins)
