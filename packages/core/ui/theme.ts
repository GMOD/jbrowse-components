import { PaletteMode } from '@mui/material'
import { blue, green, red, grey, amber } from '@mui/material/colors'
import { createTheme, ThemeOptions } from '@mui/material/styles'
import type {
  PaletteAugmentColorOptions,
  PaletteOptions,
} from '@mui/material/styles/createPalette'
import deepmerge from 'deepmerge'

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

function getJBrowseDefaultPalette(mode?: PaletteMode) {
  return {
    mode,
    ...(mode === 'dark'
      ? {
          primary: { main: grey[700] },
          secondary: { main: grey[800] },
          tertiary: refTheme.palette.augmentColor({
            color: { main: grey[900] },
          }),
          quaternary: refTheme.palette.augmentColor({
            color: { main: mandarin },
          }),
        }
      : {
          // palette values for light mode
          primary: { main: midnight },
          secondary: { main: grape },
          tertiary: refTheme.palette.augmentColor({ color: { main: forest } }),
          quaternary: refTheme.palette.augmentColor({
            color: { main: mandarin },
          }),
        }),

    stopCodon: '#e22',
    startCodon: '#3e3',
    bases: {
      A: refTheme.palette.augmentColor({ color: green }),
      C: refTheme.palette.augmentColor({ color: blue }),
      G: refTheme.palette.augmentColor({ color: amber }),
      T: refTheme.palette.augmentColor({ color: red }),
    },
  }
}

export function createJBrowseDefaultProps(/* palette: PaletteOptions = {} */) {
  return {
    components: {
      MuiButton: {
        defaultProps: {
          size: 'small' as const,
        },
      },
      MuiAccordion: {
        defaultProps: {
          disableGutters: true,
          TransitionProps: { timeout: 150 },
        },
      },
      MuiFilledInput: {
        defaultProps: {
          margin: 'dense' as const,
        },
      },
      MuiFormControl: {
        defaultProps: {
          margin: 'dense' as const,
          size: 'small' as const,
        },
      },
      MuiFormHelperText: {
        defaultProps: {
          margin: 'dense' as const,
        },
      },

      MuiIconButton: {
        defaultProps: {
          size: 'small' as const,
        },
      },
      MuiInputBase: {
        defaultProps: {
          margin: 'dense' as const,
        },
      },
      MuiAutocomplete: {
        defaultProps: {
          size: 'small' as const,
        },
      },
      MuiInputLabel: {
        defaultProps: {
          margin: 'dense' as const,
        },
      },
      MuiToolbar: {
        defaultProps: {
          variant: 'dense' as const,
        },
      },
      MuiListItem: {
        defaultProps: {
          dense: true,
        },
      },
      MuiOutlinedInput: {
        defaultProps: {
          margin: 'dense' as const,
        },
      },
      MuiFab: {
        defaultProps: {
          size: 'small' as const,
        },
      },
      MuiTable: {
        defaultProps: {
          size: 'small' as const,
        },
      },
      MuiPopover: {
        defaultProps: {
          transitionDuration: 0,
        },
      },
      MuiMenu: {
        defaultProps: {
          transitionDuration: 0,
        },
      },
      MuiMenuList: {
        defaultProps: {
          dense: true,
        },
      },
      MuiMenuItem: {
        defaultProps: {
          dense: true,
        },
      },

      MuiTextField: {
        defaultProps: {
          margin: 'dense' as const,
          variant: 'standard' as const,
        },
      },
    },
  }
}

export function createJBrowseDefaultOverrides(palette: PaletteOptions = {}) {
  const generatedPalette = deepmerge(
    getJBrowseDefaultPalette(palette.mode),
    palette,
  )
  return {
    components: {
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
      MuiAccordionSummary: {
        styleOverrides: {
          root: {
            backgroundColor: generatedPalette.tertiary.main,
          },
          content: {
            color: generatedPalette.tertiary.contrastText,
          },
        },
      },
    },
  }
}

export function createJBrowseBaseTheme(palette?: PaletteOptions): ThemeOptions {
  return {
    palette: getJBrowseDefaultPalette(palette?.mode),
    typography: { fontSize: 12 },
    spacing: 4,
    ...deepmerge(
      createJBrowseDefaultProps(),
      createJBrowseDefaultOverrides(palette),
    ),
  }
}

export function createJBrowseTheme(theme?: ThemeOptions) {
  if (theme?.palette?.tertiary) {
    theme = deepmerge(theme, {
      palette: {
        tertiary: refTheme.palette.augmentColor(
          'color' in theme.palette.tertiary
            ? (theme.palette.tertiary as PaletteAugmentColorOptions)
            : { color: theme.palette.tertiary },
        ),
      },
    })
  }
  if (theme?.palette?.quaternary) {
    theme = deepmerge(theme, {
      palette: {
        quaternary: refTheme.palette.augmentColor(
          'color' in theme.palette.quaternary
            ? (theme.palette.quaternary as PaletteAugmentColorOptions)
            : { color: theme.palette.quaternary },
        ),
      },
    })
  }

  return createTheme(
    deepmerge(createJBrowseBaseTheme(theme?.palette), theme || {}),
  )
}
