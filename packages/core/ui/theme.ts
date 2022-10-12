import { blue, green, red, amber } from '@mui/material/colors'
import { createTheme, ThemeOptions } from '@mui/material/styles'
import type { PaletteOptions } from '@mui/material/styles/createPalette'
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
    refNames: string[]
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
    refNames?: string[]
  }
}

// Based on the UCSC Genome Browser chromosome color palette:
// https://github.com/ucscGenomeBrowser/kent/blob/a50ed53aff81d6fb3e34e6913ce18578292bc24e/src/hg/inc/chromColors.h
// Some colors darkened to have at least a 3:1 contrast ratio on a white
// background
const refNameColors = [
  'rgb(153, 102, 0)',
  'rgb(102, 102, 0)',
  'rgb(153, 153, 30)',
  'rgb(204, 0, 0)',
  'rgb(255, 0, 0)',
  'rgb(255, 0, 204)',
  'rgb(165, 132, 132)', // originally 'rgb(255, 204, 204)'
  'rgb(204, 122, 0)', // originally rgb(255, 153, 0)'
  'rgb(178, 142, 0)', // originally 'rgb(255, 204, 0)'
  'rgb(153, 153, 0)', // originally 'rgb(255, 255, 0)'
  'rgb(122, 153, 0)', // originally 'rgb(204, 255, 0)'
  'rgb(0, 165, 0)', // originally 'rgb(0, 255, 0)'
  'rgb(53, 128, 0)',
  'rgb(0, 0, 204)',
  'rgb(96, 145, 242)', // originally 'rgb(102, 153, 255)'
  'rgb(107, 142, 178)', // originally 'rgb(153, 204, 255)'
  'rgb(0, 165, 165)', // originally 'rgb(0, 255, 255)'
  'rgb(122, 153, 153)', // originally 'rgb(204, 255, 255)'
  'rgb(153, 0, 204)',
  'rgb(204, 51, 255)',
  'rgb(173, 130, 216)', // originally 'rgb(204, 153, 255)'
  'rgb(102, 102, 102)',
  'rgb(145, 145, 145)', // originally 'rgb(153, 153, 153)'
  'rgb(142, 142, 142)', // originally 'rgb(204, 204, 204)'
  'rgb(142, 142, 107)', // originally 'rgb(204, 204, 153)'
  'rgb(96, 163, 48)', // originally 'rgb(121, 204, 61)'
]

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
  refNames: refNameColors,
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

export function createJBrowseBaseTheme(palette?: PaletteOptions): ThemeOptions {
  return {
    palette: jbrowseDefaultPalette,
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
            ? theme.palette.tertiary
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
            ? theme.palette.quaternary
            : { color: theme.palette.quaternary },
        ),
      },
    })
  }

  return createTheme(
    deepmerge(createJBrowseBaseTheme(theme?.palette), theme || {}),
  )
}
