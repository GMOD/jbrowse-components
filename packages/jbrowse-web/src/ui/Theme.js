import { createMuiTheme } from '@material-ui/core/styles'

export default createMuiTheme({
  palette: {
    // type: 'dark',
    primary: { main: '#396494' },
    secondary: { main: '#399469' },
  },
  typography: {
    useNextVariants: true,
  },
  overrides: {
    MuiToolbar: {
      root: {
        height: '48px',
      },
    },
    MuiDrawer: {
      paper: {
        width: '25%',
      },
    },
  },
})
