import { blue, green, red, amber } from '@material-ui/core/colors'
import { ThemeOptions, createTheme } from '@material-ui/core/styles'
import { PaletteOptions } from '@material-ui/core/styles/createPalette'
import deepmerge from 'deepmerge'

// use this if we ever want to add some top-level thing to the theme
// declare module '@material-ui/core/styles/createMuiTheme' {
//   interface Theme {
//     status: {
//       topLevelThing: string
//     }
//   }
//   interface ThemeOptions {
//     status?: {
//       topLevelThing?: string
//     }
//   }
// }

declare module '@material-ui/core/styles/createPalette' {
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
  tertiary: refTheme.palette.augmentColor({ main: forest }),
  quaternary: refTheme.palette.augmentColor({ main: mandarin }),
  stopCodon: '#e22',
  startCodon: '#3e3',
  altStartCodon: '#aca',
  bases: {
    A: refTheme.palette.augmentColor(green),
    C: refTheme.palette.augmentColor(blue),
    G: refTheme.palette.augmentColor(amber),
    T: refTheme.palette.augmentColor(red),
  },
}

export function createJBrowseDefaultProps(/* palette: PaletteOptions = {} */) {
  return {
    MuiButton: {
      size: 'small' as const,
    },
    MuiFilledInput: {
      margin: 'dense' as const,
    },
    MuiFormControl: {
      margin: 'dense' as const,
    },
    MuiFormHelperText: {
      margin: 'dense' as const,
    },
    MuiIconButton: {
      size: 'small' as const,
    },
    MuiInputBase: {
      margin: 'dense' as const,
    },
    MuiList: {
      dense: true,
    },
    MuiListItem: {
      dense: true,
    },
    MuiOutlinedInput: {
      margin: 'dense' as const,
    },
    MuiFab: {
      size: 'small' as const,
    },
    MuiTable: {
      size: 'small' as const,
    },
    MuiTextField: {
      margin: 'dense' as const,
      size: 'small' as const,
    },
    MuiToolbar: {
      variant: 'dense' as const,
    },
    MuiSvgIcon: {
      fontSize: 'small' as const,
    },
    MuiToggleButtonGroup: {
      size: 'small' as const,
    },
    MuiCheckbox: {
      size: 'small' as const,
    },
    MuiLink: {
      underline: 'always' as const,
    },
  }
}

export function createJBrowseDefaultOverrides(palette: PaletteOptions = {}) {
  const generatedPalette = deepmerge(jbrowseDefaultPalette, palette)
  return {
    MuiIconButton: {
      colorSecondary: {
        color: generatedPalette.tertiary.main,
      },
    },
    MuiButton: {
      textSecondary: {
        color: generatedPalette.tertiary.main,
      },
    },
    MuiFab: {
      secondary: {
        backgroundColor: generatedPalette.quaternary.main,
      },
    },
    MuiLink: {
      root: {
        color: generatedPalette.tertiary.main,
      },
    },
    MuiAccordion: {
      root: {
        // avoid extra padding around accordion element
        margin: 0,
        '&$expanded': {
          margin: 0,
        },
      },
    },
    MuiAccordionSummary: {
      root: {
        // !important needed to combat the MuiButton being applied to
        // accordions in mui4.12.2 having a background:'transparent' that
        // otherwise overrides this other
        backgroundColor: generatedPalette.tertiary.main + ' !important',

        // width:100% added in 4.12.2 also
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
    // makes menus more compact
    MuiMenuItem: {
      root: {
        paddingTop: 3,
        paddingBottom: 3,
      },
    },

    // the below two are linked to make menus more compact
    MuiListItemIcon: {
      root: {
        minWidth: 32,
      },
    },
    MuiListItemText: {
      inset: {
        paddingLeft: 32,
      },
    },
  }
}

export const jbrowseBaseTheme: ThemeOptions = {
  palette: jbrowseDefaultPalette,
  typography: { fontSize: 12 },
  spacing: 4,
  props: createJBrowseDefaultProps(),
  overrides: createJBrowseDefaultOverrides(),
}

export function createJBrowseTheme(theme?: ThemeOptions) {
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
