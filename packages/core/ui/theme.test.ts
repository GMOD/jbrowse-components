import { createJBrowseTheme } from './theme'

describe('theme utils', () => {
  it('can create a default theme', () => {
    const theme = createJBrowseTheme()
    expect(theme.palette.primary.main).toEqual('#0D233F')
    expect(theme.palette.secondary.main).toEqual('#721E63')
    expect(theme.palette.tertiary.main).toEqual('#135560')
    expect(theme.palette.quaternary.main).toEqual('#FFB11D')
  })
  it('allows overriding primary and secondary colors', () => {
    const theme = createJBrowseTheme({
      palette: {
        primary: { main: '#888888' },
        secondary: { main: 'rgb(137,137,137)' },
      },
    })
    expect(theme.palette.primary.main).toEqual('#888888')
    expect(theme.palette.secondary.main).toEqual('rgb(137,137,137)')
  })
  it('allows overriding tertiary and quaternary colors', () => {
    const theme = createJBrowseTheme({
      palette: {
        tertiary: { color: { 500: '#888' } },
        quaternary: { color: { main: 'hsl(0,0,54)' } },
      },
    })
    expect(theme.palette.tertiary.main).toEqual('#888')
    expect(theme.palette.tertiary.light).toBeTruthy()
    expect(theme.palette.quaternary.main).toEqual('hsl(0,0,54)')
    expect(theme.palette.quaternary.dark).toBeTruthy()
  })
  it('allows customizing spacing', () => {
    const defaultTheme = createJBrowseTheme()
    expect(defaultTheme.spacing(1)).toBe('4px')
    const biggerSpacingTheme = createJBrowseTheme({ spacing: 16 })
    expect(biggerSpacingTheme.spacing(1)).toBe('16px')
  })
  // it('allows adding a custom override', () => {
  //   const muiPaperStyle = { root: { backgroundColor: 'green' } }
  //   const theme = createJBrowseTheme({
  //     overrides: { MuiPaper: muiPaperStyle },
  //   })
  //   expect(theme.overrides?.MuiPaper).toEqual(muiPaperStyle)
  //   expect(Object.keys(theme.overrides || {}).length).toBe(10)
  // })
  // it('allows modifying a default override', () => {
  //   const muiButtonStyle = { textSecondary: { color: 'orange' } }
  //   const theme = createJBrowseTheme({
  //     overrides: { MuiButton: muiButtonStyle },
  //   })
  //   expect(theme.overrides?.MuiButton).toEqual(muiButtonStyle)
  //   expect(Object.keys(theme.overrides || {}).length).toBe(9)
  // })
  // it('allows adding a custom prop', () => {
  //   const muiPaperProps = { variant: 'outlined' as const }
  //   const theme = createJBrowseTheme({ props: { MuiPaper: muiPaperProps } })
  //   expect(theme.props?.MuiPaper).toEqual(muiPaperProps)
  //   expect(Object.keys(theme.props || {}).length).toBe(18)
  // })
  // it('allows modifying a prop override', () => {
  //   const muiButtonProps = { size: 'medium' as const }
  //   const theme = createJBrowseTheme({ props: { MuiButton: muiButtonProps } })
  //   expect(theme.props?.MuiButton).toEqual(muiButtonProps)
  //   expect(Object.keys(theme.props || {}).length).toBe(17)
  // })
})
