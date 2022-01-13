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
      size: 'small' as 'small',
    },
    MuiFilledInput: {
      margin: 'dense' as 'dense',
    },
    MuiFormControl: {
      margin: 'dense' as 'dense',
    },
    MuiFormHelperText: {
      margin: 'dense' as 'dense',
    },
    MuiIconButton: {
      size: 'small' as 'small',
    },
    MuiInputBase: {
      margin: 'dense' as 'dense',
    },
    MuiList: {
      dense: true,
    },
    MuiListItem: {
      dense: true,
    },
    MuiOutlinedInput: {
      margin: 'dense' as 'dense',
    },
    MuiFab: {
      size: 'small' as 'small',
    },
    MuiTable: {
      size: 'small' as 'small',
    },
    MuiTextField: {
      margin: 'dense' as 'dense',
      size: 'small' as 'small',
    },
    MuiToolbar: {
      variant: 'dense' as 'dense',
    },
    MuiSvgIcon: {
      fontSize: 'small' as 'small',
    },
    MuiToggleButtonGroup: {
      size: 'small' as 'small',
    },
    MuiCheckbox: {
      size: 'small' as 'small',
    },
    MuiLink: {
      underline: 'always' as 'always',
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
