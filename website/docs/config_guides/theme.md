---
id: theme
title: Coloring/theming
---

import Figure from '../figure'

### Color

The color scheme as well as some sizing options can be configured via the theme.
This is done via a top-level configuration in the config file. For example:

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

### Dark themes, extra themes, and system settings

JBrowse themes can be defined as either a `"light":` or `"dark":` theme, should
the administrator wish to define both. Without an explicitly defined light or
dark theme, JBrowse will generate an acceptable light or dark mode theme for the
user should their preference setting require it.

Example

```json
{
  "configuration": {
    "theme": {
      "light": {
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
      },
      "dark": {
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

Extra themes can be defined via the config. In jbrowse-web and jbrowse-desktop,
the user can select these themes from the Tools>Preferences menu.

From this dialog, you can also select whether you would like to use light, dark,
or system mode for the theme. Selecting "system" will adopt your desktop's
system-level theming preference.

An administrator can use MUI's built-in dark mode themeing by adding the
`"mode": "dark"` option to their theme. Some more information about MUI's dark
mode can be found here: https://mui.com/material-ui/customization/dark-mode/.

Example

```json
{
  "configuration": {
    "extraThemes": {
      "myTheme": {
        "name": "My theme",
        "dark": {
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
}
```

### Logo

It is also possible to supply a custom logo to be displayed in the top right
corner of the app instead of the JBrowse 2 logo. To do this, store a SVG file
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

The dimensions of the logo should be `150x48px`.

### Sizing

You can also change some sizing options by specifying the "typography" (to
change font size) and "spacing" (to change the amount of space between elements)
options:

```json
{
  "theme": {
    "typography": { "fontSize": 10 },
    "spacing": 2
  }
}
```

### Advanced

JBrowse uses Material-UI for its theming. You can read more about Material-UI
themes [here](https://mui.com/material-ui/customization/theming/). Generally,
most options that you can pass to Material-UI's
[`createTheme`](https://mui.com/material-ui/customization/theming/#createtheme-options-args-theme)
should work in the theme configuration.

Some aspects of the theme, like style override, can accept callback functions
which is not available via the config, but could be added via a plugin. See
https://github.com/GMOD/jbrowse-components/blob/main/test_data/volvox/umd_plugin.js
for an example of adding a theme via a plugin. This example also contains
examples of overriding the 'default' theme from a plugin
