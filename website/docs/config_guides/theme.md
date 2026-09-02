---
title: Coloring/theming
description:
  Customizing the application color theme, logo, and the user-preference
  defaults an instance ships with
guide_category: Appearance
---

**TL;DR:** set colors and sizing under a top-level `theme` in the
[`configuration`](/docs/config/jbrowseconfiguration) section. JBrowse's palette
has four customizable colors (`primary`, `secondary`, `tertiary`, `quaternary`);
add `"mode": "dark"` inside a palette for dark mode. `configuration.preferences`
sets the starting value of the settings users can toggle for themselves.

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

## Extra themes and dark mode

`extraThemes` entries show up in the Preferences dialog for the user to select.
`"mode": "dark"` inside any palette switches it to
[MUI's dark mode](https://mui.com/material-ui/customization/dark-mode/), on the
top-level `theme` too:

```json
{
  "configuration": {
    "extraThemes": {
      "myTheme": {
        "name": "My theme",
        "palette": {
          "mode": "dark",
          "primary": { "main": "#311b92" }
        }
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

[PreferencesConfigSchema](/docs/config/preferencesconfigschema) lists each slot.
A session that names `useWorkspaces` itself still wins over the preference.

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
