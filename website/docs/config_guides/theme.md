---
title: Coloring/theming
description: Customizing the application color theme
guide_category: Other features
---

### Color

The color scheme and some sizing options are configured via a top-level `theme`
in the config file. For example:

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

JBrowse uses 4 colors that can be changed. For example, this is the default
theme:

<Figure src="/img/default_theme.png" caption="Example screenshot showing the default theme"/>

<Figure src="/img/customized_theme.png" caption="Example screenshot showing the customized theme"/>

The customized theme screenshot uses the below configuration:

|            | Color code | Color       |
| ---------- | ---------- | ----------- |
| Primary    | #311b92    | Deep purple |
| Secondary  | #0097a7    | Cyan        |
| Tertiary   | #f57c00    | Orange      |
| Quaternary | #d50000    | Red         |

`tertiary` and `quaternary` are JBrowse extensions to the standard MUI palette
(which has only `primary`/`secondary`); the rest of the palette behaves as MUI
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

### Extra themes and dark mode

You can add extra themes via the config. In jbrowse-web and jbrowse-desktop,
these show up in a "Preferences" dialog that the user can select from. Dark mode
themes are also supported. Adding `"mode": "dark"` to your theme will use
[MUI's dark mode](https://mui.com/material-ui/customization/dark-mode/).

Example

```json
{
  "configuration": {
    "extraThemes": {
      "myTheme": {
        "name": "My theme",
        "mode": "dark",
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
}
```

### Logo

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

The built-in logo is `150x48px`. A custom logo is shown at its natural size, so
size your SVG similarly to fit the header.

### Sizing

You can also change some sizing options by specifying the "typography" (to
change font size) and "spacing" (to change the amount of space between elements)
options:

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

### Advanced

JBrowse uses Material-UI for its theming. You can read more about Material-UI
themes [here](https://mui.com/material-ui/customization/theming/). Generally,
most options that you can pass to Material-UI's
[`createTheme`](https://mui.com/material-ui/customization/theming/#createtheme-options-args-theme)
should work in the theme configuration.

Some aspects of the theme, like style overrides, accept callback functions that
can't be expressed in the config but can be added via a plugin. See
[this example plugin](https://github.com/GMOD/jbrowse-components/blob/main/test_data/volvox/umd_plugin.js),
which adds a theme and overrides the 'default' theme from a plugin.
