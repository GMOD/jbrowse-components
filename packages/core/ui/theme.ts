import { createMuiTheme, ThemeOptions } from '@material-ui/core/styles'
import { PaletteOptions } from '@material-ui/core/styles/createPalette'
import deepmerge from 'deepmerge'

const refTheme = createMuiTheme()

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
  }
  interface PaletteOptions {
    tertiary?: PaletteOptions['primary']
    quaternary?: PaletteOptions['primary']
  }
}

const midnight = '#0D233F'
const grape = '#721E63'
const forest = '#135560'
const mandarin = '#FFB11D'

export const jbrowseDefaultPalette = {
  // type: 'dark',
  primary: { main: midnight },
  secondary: { main: grape },
  tertiary: refTheme.palette.augmentColor({ main: forest }),
  quaternary: refTheme.palette.augmentColor({ main: mandarin }),
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
    MuiExpansionPanelSummary: {
      root: {
        background: generatedPalette.tertiary.main,
        '&$expanded': {
          // overrides the subclass e.g. .MuiExpansionPanelSummary-root-311.MuiExpansionPanelSummary-expanded-312
          minHeight: 0,
          margin: 0,
          color: generatedPalette.tertiary.contrastText,
        },
        margin: 0,
        minHeight: 0,
        padding: '0px 24px',
      },
      content: {
        '&$expanded': {
          margin: '8px 0px',
        },
        margin: '8px 0px',
        color: generatedPalette.tertiary.contrastText,
      },
      expanded: {
        // empty block needed to keep small
      },
    },
  }
}

export const jbrowseBaseTheme: ThemeOptions = {
  palette: jbrowseDefaultPalette,
  spacing: 4,
  overrides: createJBrowseDefaultOverrides(),
}

export function createJBrowseTheme(theme?: ThemeOptions) {
  if (!theme) {
    return createMuiTheme(jbrowseBaseTheme)
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
    overrides: deepmerge(
      createJBrowseDefaultOverrides(theme.palette),
      theme.overrides || {},
    ),
  }
  return createMuiTheme(deepmerge(jbrowseBaseTheme, theme))
}
