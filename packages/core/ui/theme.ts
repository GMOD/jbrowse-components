import { blue, green, red, grey, amber } from '@mui/material/colors'
import { createTheme, ThemeOptions } from '@mui/material/styles'
import type {
  PaletteOptions,
  PaletteAugmentColorOptions,
} from '@mui/material/styles/createPalette'
import deepmerge from 'deepmerge'

declare module '@mui/material/styles/createPalette' {
  interface Palette {
    tertiary: Palette['primary']
    quaternary: Palette['primary']
    stopCodon?: string
    startCodon?: string
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
    stopCodon?: string
    startCodon?: string
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
const { palette } = refTheme

function getDefaultPalette() {
  return {
    mode: undefined,
    primary: { main: midnight },
    secondary: { main: grape },
    tertiary: palette.augmentColor({ color: { main: forest } }),
    quaternary: palette.augmentColor({ color: { main: mandarin } }),
    stopCodon: '#e22',
    startCodon: '#3e3',
    bases: {
      A: palette.augmentColor({ color: green }),
      C: palette.augmentColor({ color: blue }),
      G: palette.augmentColor({ color: amber }),
      T: palette.augmentColor({ color: red }),
    },
  }
}

function getDarkPalette() {
  return {
    mode: 'dark' as const,
    primary: { main: grey[700] },
    secondary: { main: grey[800] },
    tertiary: palette.augmentColor({ color: { main: grey[900] } }),
    quaternary: palette.augmentColor({ color: { main: mandarin } }),
    stopCodon: '#e22',
    startCodon: '#3e3',
    bases: {
      A: palette.augmentColor({ color: green }),
      C: palette.augmentColor({ color: blue }),
      G: palette.augmentColor({ color: amber }),
      T: palette.augmentColor({ color: red }),
    },
  }
}

function getMinimalPalette() {
  return {
    primary: { main: grey[900] },
    secondary: { main: grey[800] },
    tertiary: palette.augmentColor({ color: { main: grey[900] } }),
    quaternary: palette.augmentColor({ color: { main: mandarin } }),
    stopCodon: '#e22',
    startCodon: '#3e3',
    bases: {
      A: palette.augmentColor({ color: green }),
      C: palette.augmentColor({ color: blue }),
      G: palette.augmentColor({ color: amber }),
      T: palette.augmentColor({ color: red }),
    },
  }
}

const palettes = {
  dark: getDarkPalette(),
  light: getDefaultPalette(),
  minimal: getMinimalPalette(),
} as const

export function createDefaultProps() {
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

export function createDefaultOverrides(
  palette: PaletteOptions = {},
  paletteName = 'light',
) {
  const generatedPalette = deepmerge(
    // @ts-ignore
    palettes[paletteName as keyof typeof palettes] || palettes['light'],
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

export function createJBrowseBaseTheme(
  palette: PaletteOptions | undefined,
  paletteName?: string,
): ThemeOptions {
  return {
    palette,
    typography: { fontSize: 12 },
    spacing: 4,
    ...deepmerge(
      createDefaultProps(),
      createDefaultOverrides(palette, paletteName),
    ),
  }
}

export function createJBrowseTheme(
  theme: ThemeOptions = {},
  paletteName?: string,
) {
  return createTheme(getCurrentTheme(theme, paletteName))
}

export function getCurrentTheme(
  theme: ThemeOptions = {},
  paletteName?: string,
) {
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

  const opt = paletteName || palette?.mode || 'light'
  const pal =
    palettes[opt as keyof typeof palettes] ||
    theme?.palette ||
    palettes['light']

  return deepmerge(createJBrowseBaseTheme(pal, paletteName), theme)
}
