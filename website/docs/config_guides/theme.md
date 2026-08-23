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

The color scheme and some sizing options are configured via a top-level `theme`
in the [`configuration`](/docs/config/jbrowseconfiguration) section of the
config file. For example:

```json
{
  "configuration": {
    "theme": {
      "palette": {
        "primary": {
          "main": "#4400a6"
        }
      }
    }
  }
}
```

JBrowse's palette has 4 customizable colors. Here's the default theme next to a
theme customized with the palette below:

<Figure src="/img/default_theme.png" caption="Example screenshot showing the default theme"/>

<Figure src="/img/customized_theme.png" caption="Example screenshot showing the customized theme"/>

The customized theme uses this configuration:

|            | Color code | Color       |
| ---------- | ---------- | ----------- |
| Primary    | #311b92    | Deep purple |
| Secondary  | #0097a7    | Cyan        |
| Tertiary   | #f57c00    | Orange      |
| Quaternary | #d50000    | Red         |

`tertiary` and `quaternary` are JBrowse extensions to the standard MUI palette
(which has only `primary`/`secondary`). The rest of the palette behaves as MUI
documents.

```json
{
  "configuration": {
    "theme": {
      "palette": {
        "primary": {
          "main": "#311b92"
        },
        "secondary": {
          "main": "#0097a7"
        },
        "tertiary": {
          "main": "#f57c00"
        },
        "quaternary": {
          "main": "#d50000"
        }
      }
    }
  }
}
```

## Extra themes and dark mode

Extra themes added via the config show up in a "Preferences" dialog in
jbrowse-web and jbrowse-desktop for the user to select.

Dark mode is enabled by adding `"mode": "dark"` inside a theme's `palette`,
which switches it to
[MUI's dark mode](https://mui.com/material-ui/customization/dark-mode/). This
works both on an `extraThemes` entry and on the top-level `theme`, where it
makes the default theme dark.

Example:

```json
{
  "configuration": {
    "extraThemes": {
      "myTheme": {
        "name": "My theme",
        "palette": {
          "mode": "dark",
          "primary": {
            "main": "#311b92"
          },
          "secondary": {
            "main": "#0097a7"
          },
          "tertiary": {
            "main": "#f57c00"
          },
          "quaternary": {
            "main": "#d50000"
          }
        }
      }
    }
  }
}
```

## Logo

A custom logo replaces the JBrowse 2 logo in the top right corner. Store an SVG
file on your server and specify its path:

```json
{
  "configuration": {
    "logoPath": {
      "uri": "path/to/my/custom-logo.svg"
    }
  }
}
```

The logo is auto-fitted to the toolbar: full bar height, automatic width to
preserve the aspect ratio, capped at 150px wide. A wide, short logo (roughly
3:1) fills the space best; a tall one is capped by the width limit and ends up
small.

## Sizing

`typography` and `spacing` adjust font size and the space between elements:

```json
{
  "configuration": {
    "theme": {
      "typography": { "fontSize": 10 },
      "spacing": 2
    }
  }
}
```

## User preference defaults

`configuration.preferences` sets the starting value of the settings a user can
change for themselves in the Preferences dialog. A user's own choice is stored
in `localStorage` and wins from then on, so these are defaults for your
instance, not a way to lock a setting down.

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

- [`numberGrouping`](/docs/config/preferencesconfigschema/#slot-configurationpreferencesnumbergrouping)
  writes coordinates with thousands separators (`chr1:1,234,567`). Turn it off
  for an instance whose users copy coordinates into tools that reject the
  commas.
- [`scrollZoom`](/docs/config/preferencesconfigschema/#slot-configurationpreferencesscrollzoom)
  makes the mouse wheel zoom without Ctrl held.
- [`useWorkspaces`](/docs/config/preferencesconfigschema/#slot-configurationpreferencesuseworkspaces)
  opens views as tabbed/tiled panels rather than a vertical stack. A session
  that names `useWorkspaces` itself still wins over this.
- [`animationMode`](/docs/config/preferencesconfigschema/#slot-configurationpreferencesanimationmode)
  is `enabled`, `disabled`, or `system`, which follows the OS
  prefers-reduced-motion setting.

## Advanced

JBrowse uses [Material-UI](https://mui.com/material-ui/customization/theming/)
for its theming (see the
[developer theming guide](/docs/developer_guides/theming) for the full palette
and exported color constants). Most options you can pass to MUI's
[`createTheme`](https://mui.com/material-ui/customization/theming/#createtheme-options-args-theme)
work in the theme configuration.

Some aspects of the theme, like style overrides, accept callback functions that
can't be expressed in the config but can be added via a plugin. See
[this example plugin](https://github.com/GMOD/jbrowse-components/blob/main/test_data/volvox/umd_plugin.js),
which adds a theme and overrides the 'default' theme from a plugin. See
[no-build plugin tutorial](/docs/developer_guides/no_build_plugin) for how to
load a small plugin like this from config.

## See also

- [Theming (developer guide)](/docs/developer_guides/theming)
- [JBrowseConfiguration config docs](/docs/config/jbrowseconfiguration)
- [Configuring plugins](/docs/config_guides/plugins)
