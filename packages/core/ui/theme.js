import { createMuiTheme } from '@material-ui/core/styles'
import { grey } from '@material-ui/core/colors'

export default createMuiTheme({
  palette: {
    // type: 'dark',
    primary: { main: '#0D233F' },
    secondary: { main: '#721E63' },
    background: {
      mainApp: grey[700],
    },
  },
  overrides: {
    MuiIconButton: {
      colorSecondary: {
        color: '#135560',
      },
    },
    MuiButton: {
      textSecondary: {
        color: '#135560',
      },
    },
    MuiFab: {
      secondary: {
        backgroundColor: '#FFB11D',
      },
    },
    MuiExpansionPanelSummary: {
      root: {
        background: '#135560',
        '&$expanded': {
          // overrides the subclass e.g. .MuiExpansionPanelSummary-root-311.MuiExpansionPanelSummary-expanded-312
          minHeight: 0,
          margin: 0,
          color: '#FFFFFF',
        },
        margin: 0,
        minHeight: 0,
        padding: '0px 8px',
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
