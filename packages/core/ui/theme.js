import { createMuiTheme } from '@material-ui/core/styles'
import { grey } from '@material-ui/core/colors'
import {
  lighten,
  darken,
  getContrastRatio,
} from '@material-ui/core/styles/colorManipulator'

const midnight = '#0D233F'
const grape = '#721E63'
const forest = '#135560'
const mandarin = '#FFB11D'

export default createMuiTheme({
  typography: {
    fontSize: 12,
  },
  palette: {
    // type: 'dark',
    primary: { main: midnight },
    secondary: { main: grape },
    tertiary: {
      light: lighten(forest, 0.2),
      main: forest,
      dark: darken(forest, 0.3),
      contrastText:
        getContrastRatio(forest, '#fff') >= 3 ? '#fff' : 'rgba(0, 0, 0, 0.87)',
    },
    background: {
      mainApp: grey[700],
    },
  },
  props: {
    MuiMenuItem: {
      root: {
        padding: 0,
      },
    },
    MuiButtonBase: {
      disableRipple: true,
    },
  },
  overrides: {
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
    MuiIconButton: {
      colorSecondary: {
        color: forest,
      },
    },
    MuiButton: {
      textSecondary: {
        color: forest,
      },
    },
    MuiFab: {
      secondary: {
        backgroundColor: mandarin,
      },
    },
    MuiExpansionPanelSummary: {
      root: {
        background: forest,
        '&$expanded': {
          // overrides the subclass e.g. .MuiExpansionPanelSummary-root-311.MuiExpansionPanelSummary-expanded-312
          minHeight: 0,
          margin: 0,
          color: '#FFFFFF',
        },
        margin: 0,
        minHeight: 0,
        padding: '0px 24px',
      },
      content: {
        '&$expanded': {
          margin: '8px 0px',
        },
        color: '#FFFFFF',
        margin: '8px 0px',
      },
      expanded: {
        // empty block needed to keep small
      },
    },
  },
})
