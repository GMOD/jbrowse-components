import { blue, green, red, amber } from '@mui/material/colors'
import { createTheme } from '@mui/material/styles'
import { PaletteOptions } from '@mui/material/styles/createPalette'
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
      MuiAccordion: {
        defaultProps: {
          disableGutters: true,
          TransitionProps: { timeout: 150 },
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
          size: 'small',
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
      MuiAutocomplete: {
        defaultProps: {
          size: 'small',
        },
      },
      MuiInputLabel: {
        defaultProps: {
          margin: 'dense',
        },
      },
      MuiToolbar: {
        defaultProps: {
          variant: 'dense',
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
          margin: 'dense',
          variant: 'standard',
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

export const jbrowseBaseTheme = {
  palette: jbrowseDefaultPalette,
  typography: { fontSize: 12 },
  spacing: 4,
  ...deepmerge(createJBrowseDefaultProps(), createJBrowseDefaultOverrides()),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createJBrowseTheme(theme?: any) {
  if (theme?.palette?.tertiary) {
    theme = deepmerge(theme, {
      palette: {
        tertiary: refTheme.palette.augmentColor(
          theme.palette.tertiary?.color
            ? theme.palette.tertiary
            : {
                color: theme.palette.tertiary,
              },
        ),
      },
    })
  }
  if (theme?.palette?.quaternary) {
    theme = deepmerge(theme, {
      palette: {
        quaternary: refTheme.palette.augmentColor(
          theme.palette.quaternary?.color
            ? theme.palette.quaternary
            : {
                color: theme.palette.quaternary,
              },
        ),
      },
    })
  }

  // @ts-ignore
  return createTheme(deepmerge(jbrowseBaseTheme, theme || {}))
}
