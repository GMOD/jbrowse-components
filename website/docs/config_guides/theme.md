---
title: Coloring/theming
description: Customizing the application color theme
guide_category: Other features
---

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

You can add extra themes via the config. In jbrowse-web and jbrowse-desktop,
these show up in a "Preferences" dialog that the user can select from.

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

It is also possible to supply a custom logo to be displayed in the top right
corner of the app instead of the JBrowse 2 logo. To do this, store an SVG file
containing your logo on your server, and specify the path in your configuration:

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
preserve the aspect ratio, capped at 150px wide. You do not need to size your
SVG to particular pixel dimensions, but a wide, short logo (roughly 3:1) fills
the space best; a tall one will be capped by the width limit and end up small.

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

## Advanced

JBrowse uses Material-UI for its theming (see the
[developer theming guide](/docs/developer_guides/theming) for the full palette
and exported color constants). You can read more about Material-UI themes
[here](https://mui.com/material-ui/customization/theming/). Generally, most
options that you can pass to Material-UI's
[`createTheme`](https://mui.com/material-ui/customization/theming/#createtheme-options-args-theme)
should work in the theme configuration.

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
