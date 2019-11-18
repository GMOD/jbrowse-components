import { createMuiTheme } from '@material-ui/core/styles'
import useMediaQuery from '@material-ui/core/useMediaQuery'

export default function useTheme() {
  // current themes are not that good but we should support dark theme
  const prefersDarkMode =
    (useMediaQuery('(prefers-color-scheme: dark)') && window.ALLOW_DARK_MODE) ||
    window.FORCE_DARK
  return createMuiTheme({
    palette: {
      type: prefersDarkMode ? 'dark' : 'light',
      primary: { main: '#0D233F' },
      secondary: { main: '#721E63' },
    },
    overrides: {
      MuiIcon: {
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
}
