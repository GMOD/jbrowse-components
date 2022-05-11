import { blue, green, red, amber } from '@mui/material/colors'
import {
  Theme,
  DeprecatedThemeOptions,
  createTheme,
  adaptV4Theme,
} from '@mui/material/styles'
import { PaletteOptions } from '@mui/material/styles/createPalette'
import deepmerge from 'deepmerge'

declare module '@mui/styles/defaultTheme' {
  type DefaultTheme = Theme
}

// use this if we ever want to add some top-level thing to the theme
// declare module '@mui/material/styles/createMuiTheme' {
//   interface Theme {
//     status: {
//       topLevelThing: string
//     }
//   }
//   interface DeprecatedThemeOptions {
//     status?: {
//       topLevelThing?: string
//     }
//   }
// }
declare module '@mui/material/styles/createPalette' {
  interface Palette {
    tertiary: Palette['primary']
    quaternary: Palette['primary']
    bases: {
      A: Palette['primary']
      C: Palette['primary']
      G: Palette['primary']
      T: Palette['primary']
    }
  }
  interface PaletteOptions {
    tertiary?: PaletteOptions['primary']
    quaternary?: PaletteOptions['primary']
    bases?: {
      A?: PaletteOptions['primary']
      C?: PaletteOptions['primary']
      G?: PaletteOptions['primary']
      T?: PaletteOptions['primary']
    }
  }
}

const midnight = '#0D233F'
const grape = '#721E63'
const forest = '#135560'
const mandarin = '#FFB11D'

const refTheme = createTheme()

export const jbrowseDefaultPalette = {
  // type: 'dark',
  primary: { main: midnight },
  secondary: { main: grape },
  tertiary: refTheme.palette.augmentColor({ color: { main: forest } }),
  quaternary: refTheme.palette.augmentColor({ color: { main: mandarin } }),
  stopCodon: '#e22',
  startCodon: '#3e3',
  bases: {
    A: refTheme.palette.augmentColor({ color: green }),
    C: refTheme.palette.augmentColor({ color: blue }),
    G: refTheme.palette.augmentColor({ color: amber }),
    T: refTheme.palette.augmentColor({ color: red }),
  },
}

export function createJBrowseDefaultProps(/* palette: PaletteOptions = {} */) {
  return {
    components: {
      MuiButton: {
        defaultProps: {
          size: 'small',
        },
      },
      MuiFilledInput: {
        defaultProps: {
          margin: 'dense',
        },
      },
      MuiFormControl: {
        defaultProps: {
          margin: 'dense',
        },
      },
      MuiFormHelperText: {
        defaultProps: {
          margin: 'dense',
        },
      },
      MuiIconButton: {
        defaultProps: {
          size: 'small',
        },
      },
      MuiInputBase: {
        defaultProps: {
          margin: 'dense',
        },
      },
      MuiInputLabel: {
        defaultProps: {
          margin: 'dense',
        },
      },
      MuiListItem: {
        defaultProps: {
          dense: true,
        },
      },
      MuiOutlinedInput: {
        defaultProps: {
          margin: 'dense',
        },
      },
      MuiFab: {
        defaultProps: {
          size: 'small',
        },
      },
      MuiTable: {
        defaultProps: {
          size: 'small',
        },
      },
      MuiTextField: {
        defaultProps: {
          margin: 'dense',
        },
      },
      MuiToolbar: {
        defaultProps: {
          variant: 'dense',
        },
      },
    },
  }
}

export function createJBrowseDefaultOverrides(palette: PaletteOptions = {}) {
  const generatedPalette = deepmerge(jbrowseDefaultPalette, palette)
  return {
    components: {
      MuiIconButton: {
        styleOverrides: {
          colorSecondary: {
            color: generatedPalette.tertiary.main,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          textSecondary: {
            color: generatedPalette.tertiary.main,
          },
        },
      },
      MuiFab: {
        styleOverrides: {
          secondary: {
            backgroundColor: generatedPalette.quaternary.main,
          },
        },
      },
      MuiLink: {
        styleOverrides: {
          root: {
            color: generatedPalette.tertiary.main,
          },
        },
      },
      MuiAccordion: {
        styleOverrides: {
          root: {
            // avoid extra padding around accordion element
            margin: 0,
            '&$expanded': {
              margin: 0,
            },
          },
        },
      },
      MuiAccordionSummary: {
        styleOverrides: {
          root: {
            // !important needed to combat the MuiButton being applied to
            // accordions in mui5.0.0 having a background:'transparent' that
            // otherwise overrides this other
            backgroundColor: generatedPalette.tertiary.main + ' !important',

            // width:100% added in 5.0.0 also
            width: '100%',
            '&$expanded': {
              // overrides the subclass e.g. .MuiAccordionSummary-root-311.MuiAccordionSummary-expanded-312
              minHeight: 0,
              color: generatedPalette.tertiary.contrastText,
              backgroundColor: generatedPalette.tertiary.main,
            },
            minHeight: 0,
          },
          content: {
            '&$expanded': {
              margin: '8px 8px',
            },
            margin: '8px 8px',
            color: generatedPalette.tertiary.contrastText,
          },
        },
      },
      // makes menus more compact
      MuiMenuItem: {
        styleOverrides: {
          root: {
            paddingTop: 3,
            paddingBottom: 3,
          },
        },
      },

      // the below two are linked to make menus more compact
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            minWidth: 32,
          },
        },
      },
      MuiListItemText: {
        styleOverrides: {
          inset: {
            paddingLeft: 32,
          },
        },
      },
    },
  }
}

export const jbrowseBaseTheme: DeprecatedThemeOptions = {
  palette: jbrowseDefaultPalette,
  typography: { fontSize: 12 },
  spacing: 4,
  ...deepmerge(createJBrowseDefaultProps(), createJBrowseDefaultOverrides()),
}

export function createJBrowseTheme(theme?: DeprecatedThemeOptions) {
  if (!theme) {
    return createTheme(jbrowseBaseTheme)
  }
  if (theme.palette?.tertiary) {
    theme = {
      ...theme,
      palette: {
        ...theme.palette,
        tertiary: refTheme.palette.augmentColor(theme.palette.tertiary),
      },
    }
  }
  if (theme.palette?.quaternary) {
    theme = {
      ...theme,
      palette: {
        ...theme.palette,
        quaternary: refTheme.palette.augmentColor(theme.palette.quaternary),
      },
    }
  }
  theme = {
    ...theme,
    props: deepmerge(createJBrowseDefaultProps(), theme.props || {}),
    overrides: deepmerge(
      createJBrowseDefaultOverrides(theme.palette),
      theme.overrides || {},
    ),
  }
  return createTheme(deepmerge(jbrowseBaseTheme, theme))
}
