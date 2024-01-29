import { blue, green, red, grey, orange } from '@mui/material/colors'
import { createTheme, ThemeOptions } from '@mui/material/styles'
import type {
  PaletteAugmentColorOptions,
  PaletteColor,
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
    frames: [
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
    stopCodon?: string
    startCodon?: string
    bases?: {
      A?: PaletteOptions['primary']
      C?: PaletteOptions['primary']
      G?: PaletteOptions['primary']
      T?: PaletteOptions['primary']
    }
    frames?: [
      null,
      PaletteOptions['primary'],
      PaletteOptions['primary'],
      PaletteOptions['primary'],
      PaletteOptions['primary'],
      PaletteOptions['primary'],
      PaletteOptions['primary'],
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

const midnight = '#0D233F'
const grape = '#721E63'
const forest = '#135560'
const mandarin = '#FFB11D'

const refTheme = createTheme()

function stockTheme() {
  return {
    palette: {
      mode: undefined,
      primary: { main: midnight },
      secondary: { main: grape },
      tertiary: refTheme.palette.augmentColor({ color: { main: forest } }),
      quaternary: refTheme.palette.augmentColor({ color: { main: mandarin } }),
      stopCodon: '#e22',
      startCodon: '#3e3',
      bases: {
        A: refTheme.palette.augmentColor({ color: green }),
        C: refTheme.palette.augmentColor({ color: blue }),
        G: refTheme.palette.augmentColor({ color: orange }),
        T: refTheme.palette.augmentColor({ color: red }),
      },
      frames: [
        null,
        refTheme.palette.augmentColor({ color: { main: '#FF8080' } }),
        refTheme.palette.augmentColor({ color: { main: '#80FF80' } }),
        refTheme.palette.augmentColor({ color: { main: '#8080FF' } }),
        refTheme.palette.augmentColor({ color: { main: '#8080FF' } }),
        refTheme.palette.augmentColor({ color: { main: '#80FF80' } }),
        refTheme.palette.augmentColor({ color: { main: '#FF8080' } }),
      ] as Frames,
    },
    components: {
      MuiLink: {
        styleOverrides: {
          // the default link color uses theme.palette.primary.main which is
          // very bad with dark mode+midnight primary
          //
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          root: ({ theme }: any) => ({
            color: theme.palette.tertiary.main,
          }),
        },
      },
    },
  }
}

function getDefaultTheme() {
  return {
    name: 'Default (from config)',
    ...stockTheme(),
  }
}

function getLightStockTheme() {
  return {
    name: 'Light (stock)',
    ...stockTheme(),
  }
}

function getDarkStockTheme() {
  return {
    name: 'Dark (stock)',
    palette: {
      mode: 'dark',
      primary: { main: midnight },
      secondary: { main: grape },
      tertiary: refTheme.palette.augmentColor({ color: { main: forest } }),
      quaternary: refTheme.palette.augmentColor({ color: { main: mandarin } }),
      stopCodon: '#e22',
      startCodon: '#3e3',
      bases: {
        A: refTheme.palette.augmentColor({ color: green }),
        C: refTheme.palette.augmentColor({ color: blue }),
        G: refTheme.palette.augmentColor({ color: orange }),
        T: refTheme.palette.augmentColor({ color: red }),
      },
      frames: [
        null,
        refTheme.palette.augmentColor({ color: { main: '#FF8080' } }),
        refTheme.palette.augmentColor({ color: { main: '#80FF80' } }),
        refTheme.palette.augmentColor({ color: { main: '#8080FF' } }),
        refTheme.palette.augmentColor({ color: { main: '#8080FF' } }),
        refTheme.palette.augmentColor({ color: { main: '#80FF80' } }),
        refTheme.palette.augmentColor({ color: { main: '#FF8080' } }),
      ] as Frames,
    },
    components: {
      MuiAppBar: {
        defaultProps: {
          enableColorOnDark: true,
        },
        styleOverrides: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          primary: (props: any) => {
            return props.theme.palette.primary.main
          },
        },
      },
    },
  }
}

function getDarkMinimalTheme() {
  return {
    name: 'Dark (minimal)',
    palette: {
      mode: 'dark' as const,
      primary: { main: grey[700] },
      secondary: { main: grey[800] },
      tertiary: refTheme.palette.augmentColor({ color: { main: grey[900] } }),
      quaternary: refTheme.palette.augmentColor({ color: { main: mandarin } }),
      stopCodon: '#e22',
      startCodon: '#3e3',
      bases: {
        A: refTheme.palette.augmentColor({ color: green }),
        C: refTheme.palette.augmentColor({ color: blue }),
        G: refTheme.palette.augmentColor({ color: orange }),
        T: refTheme.palette.augmentColor({ color: red }),
      },
      frames: [
        null,
        refTheme.palette.augmentColor({ color: { main: '#FF8080' } }),
        refTheme.palette.augmentColor({ color: { main: '#80FF80' } }),
        refTheme.palette.augmentColor({ color: { main: '#8080FF' } }),
        refTheme.palette.augmentColor({ color: { main: '#8080FF' } }),
        refTheme.palette.augmentColor({ color: { main: '#80FF80' } }),
        refTheme.palette.augmentColor({ color: { main: '#FF8080' } }),
      ] as Frames,
    },
  }
}

function getMinimalTheme() {
  return {
    name: 'Light (minimal)',
    palette: {
      primary: { main: grey[900] },
      secondary: { main: grey[800] },
      tertiary: refTheme.palette.augmentColor({ color: { main: grey[900] } }),
      quaternary: refTheme.palette.augmentColor({ color: { main: mandarin } }),
      stopCodon: '#e22',
      startCodon: '#3e3',
      bases: {
        A: refTheme.palette.augmentColor({ color: green }),
        C: refTheme.palette.augmentColor({ color: blue }),
        G: refTheme.palette.augmentColor({ color: orange }),
        T: refTheme.palette.augmentColor({ color: red }),
      },
      frames: [
        null,
        refTheme.palette.augmentColor({ color: { main: '#FF8080' } }),
        refTheme.palette.augmentColor({ color: { main: '#80FF80' } }),
        refTheme.palette.augmentColor({ color: { main: '#8080FF' } }),
        refTheme.palette.augmentColor({ color: { main: '#8080FF' } }),
        refTheme.palette.augmentColor({ color: { main: '#80FF80' } }),
        refTheme.palette.augmentColor({ color: { main: '#FF8080' } }),
      ] as Frames,
    },
  }
}

export const defaultThemes = {
  default: getDefaultTheme(),
  lightStock: getLightStockTheme(),
  lightMinimal: getMinimalTheme(),
  darkMinimal: getDarkMinimalTheme(),
  darkStock: getDarkStockTheme(),
} as ThemeMap

function createDefaultProps(theme?: ThemeOptions): ThemeOptions {
  return {
    components: {
      MuiButton: {
        defaultProps: {
          size: 'small' as const,
        },
        styleOverrides: {
          // the default button, especially when not using variant=contained, uses
          // theme.palette.primary.main for text which is very bad with dark
          // mode+midnight primary
          //
          // keeps text secondary for darkmode, uses
          // a text-like coloring to ensure contrast
          // xref https://stackoverflow.com/a/72546130/2129219
          //
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          root: (props: any) => {
            const { theme } = props
            return theme.palette.mode === 'dark'
              ? {
                  color: theme.palette.text.primary,
                }
              : undefined
          },
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
          // a text-like coloring to ensure contrast
          // xref https://stackoverflow.com/a/72546130/2129219
          root: ({ theme }) => {
            return theme.palette.mode === 'dark'
              ? {
                  color: theme.palette.text.secondary,
                  '&.Mui-checked': {
                    color: theme.palette.text.secondary,
                  },
                }
              : undefined
          },
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
          root: ({ theme }) => {
            return theme.palette.mode === 'dark'
              ? {
                  color: theme.palette.text.secondary,
                  '&.Mui-checked': {
                    color: theme.palette.text.secondary,
                  },
                }
              : undefined
          },
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

          root: ({ theme }) => {
            return theme.palette.mode === 'dark'
              ? {
                  color: theme.palette.text.secondary,
                  '&.Mui-focused': {
                    color: theme.palette.text.secondary,
                  },
                }
              : undefined
          },
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
}

function overwriteArrayMerge(_: unknown, sourceArray: unknown[]) {
  return sourceArray
}

export function createJBrowseBaseTheme(theme?: ThemeOptions): ThemeOptions {
  return deepmerge(
    {
      palette: theme?.palette,
      typography: { fontSize: 12 },
      spacing: 4,
      ...createDefaultProps(theme),
    },
    theme || {},
    { arrayMerge: overwriteArrayMerge },
  )
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
        ? deepmerge(themes.default, augmentTheme(configTheme), {
            arrayMerge: overwriteArrayMerge,
          })
        : augmentThemePlus(themes[themeName]) || themes.default,
    ),
  )
}

function augmentTheme(theme: ThemeOptions = {}) {
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

  return theme
}

// creates some blank quaternary/tertiary colors if unsupplied by a user theme
function augmentThemePlus(theme: ThemeOptions = {}) {
  theme = augmentTheme(theme)
  if (!theme?.palette?.quaternary) {
    theme = deepmerge(theme, {
      palette: {
        quaternary: refTheme.palette.augmentColor({ color: { main: '#aaa' } }),
      },
    })
  }
  if (!theme?.palette?.tertiary) {
    theme = deepmerge(theme, {
      palette: {
        tertiary: refTheme.palette.augmentColor({ color: { main: '#aaa' } }),
      },
    })
  }
  return theme
}
