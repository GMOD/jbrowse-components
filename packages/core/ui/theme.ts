import { blue, green, red, grey, orange } from '@mui/material/colors'
import { createTheme } from '@mui/material/styles'
import deepmerge from 'deepmerge'
import type { ThemeOptions } from '@mui/material/styles'
import type {
  PaletteAugmentColorOptions,
  PaletteColor,
} from '@mui/material/styles/createPalette'

declare module '@mui/material/styles/createPalette' {
  interface Palette {
    tertiary: Palette['primary']
    quaternary: Palette['primary']
    highlight: Palette['primary']
    stopCodon?: string
    startCodon?: string
    bases: {
      A: Palette['primary']
      C: Palette['primary']
      G: Palette['primary']
      T: Palette['primary']
    }
    frames: [
      null,
      Palette['primary'] | undefined,
      Palette['primary'] | undefined,
      Palette['primary'] | undefined,
      Palette['primary'] | undefined,
      Palette['primary'] | undefined,
      Palette['primary'] | undefined,
    ]
    framesCDS: [
      null,
      Palette['primary'] | undefined,
      Palette['primary'] | undefined,
      Palette['primary'] | undefined,
      Palette['primary'] | undefined,
      Palette['primary'] | undefined,
      Palette['primary'] | undefined,
    ]
  }
  interface PaletteOptions {
    tertiary?: PaletteOptions['primary']
    quaternary?: PaletteOptions['primary']
    highlight?: PaletteOptions['primary']
    stopCodon?: string
    startCodon?: string
    bases?: {
      A?: PaletteOptions['primary']
      C?: PaletteOptions['primary']
      G?: PaletteOptions['primary']
      T?: PaletteOptions['primary']
    }
    framesCDS?: [
      null,
      Palette['primary'] | undefined,
      Palette['primary'] | undefined,
      Palette['primary'] | undefined,
      Palette['primary'] | undefined,
      Palette['primary'] | undefined,
      Palette['primary'] | undefined,
    ]
    frames?: [
      null,
      Palette['primary'] | undefined,
      Palette['primary'] | undefined,
      Palette['primary'] | undefined,
      Palette['primary'] | undefined,
      Palette['primary'] | undefined,
      Palette['primary'] | undefined,
    ]
  }
}

type Frames = [
  null,
  PaletteColor,
  PaletteColor,
  PaletteColor,
  PaletteColor,
  PaletteColor,
  PaletteColor,
]

const refTheme = createTheme()
const midnight = '#0D233F'
const grape = '#721E63'
const forest = refTheme.palette.augmentColor({ color: { main: '#135560' } })
const mandarin = refTheme.palette.augmentColor({ color: { main: '#FFB11D' } })
const lightgrey = refTheme.palette.augmentColor({ color: { main: '#aaa' } })
const bases = {
  A: refTheme.palette.augmentColor({ color: green }),
  C: refTheme.palette.augmentColor({ color: blue }),
  G: refTheme.palette.augmentColor({ color: orange }),
  T: refTheme.palette.augmentColor({ color: red }),
}
const framesCDS = [
  null,
  refTheme.palette.augmentColor({ color: { main: '#FF8080' } }),
  refTheme.palette.augmentColor({ color: { main: '#80FF80' } }),
  refTheme.palette.augmentColor({ color: { main: '#8080FF' } }),
  refTheme.palette.augmentColor({ color: { main: '#8080FF' } }),
  refTheme.palette.augmentColor({ color: { main: '#80FF80' } }),
  refTheme.palette.augmentColor({ color: { main: '#FF8080' } }),
] as Frames
const frames = [
  null,
  refTheme.palette.augmentColor({ color: { main: '#8f8f8f' } }),
  refTheme.palette.augmentColor({ color: { main: '#adadad' } }),
  refTheme.palette.augmentColor({ color: { main: '#d8d8d8' } }),
  refTheme.palette.augmentColor({ color: { main: '#d8d8d8' } }),
  refTheme.palette.augmentColor({ color: { main: '#adadad' } }),
  refTheme.palette.augmentColor({ color: { main: '#8f8f8f' } }),
] as Frames
const stopCodon = '#e22'
const startCodon = '#3e3'

function stockTheme() {
  return {
    palette: {
      mode: undefined,
      primary: { main: midnight },
      secondary: { main: grape },
      tertiary: forest,
      quaternary: mandarin,
      highlight: mandarin,
      stopCodon,
      startCodon,
      bases,
      frames,
      framesCDS,
    },
    components: {
      MuiLink: {
        styleOverrides: {
          // the default link color uses theme.palette.primary.main which is
          // very bad with dark mode+midnight primary
          root: ({ theme }) => ({
            color: theme.palette.tertiary.main,
          }),
        },
      },
    },
  } satisfies ThemeOptions
}

function getDefaultTheme() {
  return {
    ...stockTheme(),
    name: 'Default (from config)',
  }
}

function getLightStockTheme() {
  return {
    ...stockTheme(),
    name: 'Light (stock)',
  }
}

function getDarkStockTheme() {
  return {
    name: 'Dark (stock)',
    palette: {
      mode: 'dark',
      primary: { main: midnight },
      secondary: { main: grape },
      tertiary: forest,
      quaternary: mandarin,
      highlight: mandarin,
      stopCodon,
      startCodon,
      bases,
      frames,
      framesCDS,
    },
    components: {
      MuiAppBar: {
        defaultProps: {
          enableColorOnDark: true,
        },
        styleOverrides: {
          root: ({ theme }) => {
            return theme.palette.primary.main
          },
        },
      },
    },
  } satisfies ThemeOptions & { name: string }
}

function getDarkMinimalTheme() {
  return {
    name: 'Dark (minimal)',
    palette: {
      mode: 'dark' as const,
      primary: { main: grey[700] },
      secondary: { main: grey[800] },
      tertiary: refTheme.palette.augmentColor({ color: { main: grey[900] } }),
      quaternary: mandarin,
      highlight: mandarin,
      stopCodon,
      startCodon,
      bases,
      frames,
      framesCDS,
    },
  } satisfies ThemeOptions & { name: string }
}

function getMinimalTheme() {
  return {
    name: 'Light (minimal)',
    palette: {
      primary: { main: grey[900] },
      secondary: { main: grey[800] },
      tertiary: refTheme.palette.augmentColor({ color: { main: grey[900] } }),
      quaternary: mandarin,
      highlight: mandarin,
      stopCodon,
      startCodon,
      bases,
      frames,
      framesCDS,
    },
  } satisfies ThemeOptions & { name: string }
}

export const defaultThemes = {
  default: getDefaultTheme(),
  lightStock: getLightStockTheme(),
  lightMinimal: getMinimalTheme(),
  darkMinimal: getDarkMinimalTheme(),
  darkStock: getDarkStockTheme(),
} as ThemeMap

function overwriteArrayMerge(_: unknown, sourceArray: unknown[]) {
  return sourceArray
}

export function createJBrowseBaseTheme(theme?: ThemeOptions): ThemeOptions {
  const themeP: ThemeOptions = {
    palette: theme?.palette,
    typography: {
      fontSize: 12,
    },
    spacing: 4,
    components: {
      MuiButton: {
        defaultProps: {
          size: 'small' as const,
        },
        styleOverrides: {
          // the default button, especially when not using variant=contained,
          // uses theme.palette.primary.main for text which is very bad with
          // dark mode+midnight primary
          //
          // keeps text secondary for darkmode, uses
          // a text-like coloring to ensure contrast
          // xref https://stackoverflow.com/a/72546130/2129219
          root: ({ theme }) =>
            theme.palette.mode === 'dark'
              ? {
                  color: theme.palette.text.primary,
                }
              : undefined,
        },
      },
      MuiAccordion: {
        defaultProps: {
          disableGutters: true,
          slotProps: {
            transition: {
              timeout: 150,
              unmountOnExit: true,
            },
          },
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
        styleOverrides: {
          secondary: {
            // @ts-expect-error
            backgroundColor: theme?.palette?.quaternary?.main,
          },
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
      MuiLink: {
        styleOverrides: {
          // the default link color uses theme.palette.primary.main which is
          // very bad with dark mode+midnight primary
          root: ({ theme }) => ({
            color: theme.palette.text.secondary,
          }),
        },
      },
      MuiCheckbox: {
        styleOverrides: {
          // the default checkbox-when-checked color uses
          // theme.palette.primary.main which is very bad with dark
          // mode+midnight primary
          //
          // keeps the forest-green checkbox by default but for darkmode, uses
          // a text-like coloring to ensure contrast xref
          // https://stackoverflow.com/a/72546130/2129219
          root: ({ theme }) =>
            theme.palette.mode === 'dark'
              ? {
                  color: theme.palette.text.secondary,
                  '&.Mui-checked': {
                    color: theme.palette.text.secondary,
                  },
                }
              : undefined,
        },
      },
      MuiRadio: {
        styleOverrides: {
          // the default checkbox-when-checked color uses
          // theme.palette.primary.main which is very bad with dark
          // mode+midnight primary
          //
          // keeps the forest-green checkbox by default but for darkmode, uses
          // a text-like coloring to ensure contrast
          // xref https://stackoverflow.com/a/72546130/2129219
          root: ({ theme }) =>
            theme.palette.mode === 'dark'
              ? {
                  color: theme.palette.text.secondary,
                  '&.Mui-checked': {
                    color: theme.palette.text.secondary,
                  },
                }
              : undefined,
        },
      },
      MuiFormLabel: {
        styleOverrides: {
          // the default checkbox-when-checked color uses
          // theme.palette.primary.main which is very bad with dark
          // mode+midnight primary
          //
          // keeps the forest-green checkbox by default but for darkmode, uses
          // a text-like coloring to ensure contrast
          // xref https://stackoverflow.com/a/72546130/2129219
          //

          root: ({ theme }) =>
            theme.palette.mode === 'dark'
              ? {
                  color: theme.palette.text.secondary,
                  '&.Mui-focused': {
                    color: theme.palette.text.secondary,
                  },
                }
              : undefined,
        },
      },
      MuiAccordionSummary: {
        styleOverrides: {
          root: {
            // @ts-expect-error
            backgroundColor: theme?.palette?.tertiary?.main,
          },
          content: {
            // @ts-expect-error
            color: theme?.palette?.tertiary?.contrastText,
          },
        },
      },
      MuiToggleButtonGroup: {
        defaultProps: {
          size: 'small' as const,
        },
      },
    },
  }
  return deepmerge(themeP, theme || {}, { arrayMerge: overwriteArrayMerge })
}

type ThemeMap = Record<string, ThemeOptions>

export function createJBrowseTheme(
  configTheme: ThemeOptions = {},
  themes = defaultThemes,
  themeName = 'default',
) {
  return createTheme(
    createJBrowseBaseTheme(
      themeName === 'default'
        ? deepmerge(themes.default!, augmentThemeColors(configTheme), {
            arrayMerge: overwriteArrayMerge,
          })
        : addMissingColors(themes[themeName]),
    ),
  )
}

// MUI by default allows strings like '#f00' for primary and secondary and
// augments them to have light and dark variants but not for anything else, so
// we augment them here
function augmentThemeColors(theme: ThemeOptions = {}) {
  for (const entry of ['tertiary', 'quaternary', 'highlight'] as const) {
    if (theme.palette?.[entry]) {
      theme = deepmerge(theme, {
        palette: {
          [entry]: refTheme.palette.augmentColor(
            'color' in theme.palette[entry]
              ? (theme.palette[entry] as PaletteAugmentColorOptions)
              : { color: theme.palette[entry] },
          ),
        },
      })
    }
  }
  return theme
}

// adds missing colors to users theme
function addMissingColors(theme: ThemeOptions = {}) {
  return augmentThemeColors(
    deepmerge(theme, {
      palette: {
        quaternary: theme.palette?.quaternary || lightgrey,
        tertiary: theme.palette?.tertiary || lightgrey,
        highlight: theme.palette?.highlight || mandarin,
      },
    }),
  )
}
