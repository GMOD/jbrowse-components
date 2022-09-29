import { createJBrowseTheme } from './theme'

describe('theme utils', () => {
  it('can create a default theme', () => {
    const theme = createJBrowseTheme()
    // @ts-ignore
    const { primary, secondary, tertiary, quaternary } = theme.palette
    expect(primary.main).toEqual('#0D233F')
    expect(secondary.main).toEqual('#721E63')
    expect(tertiary.main).toEqual('#135560')
    expect(quaternary.main).toEqual('#FFB11D')
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
        tertiary: { 500: '#888' },
        quaternary: { main: 'hsl(0,0,54)' },
      },
    })
    // @ts-ignore
    const { tertiary, quaternary } = theme.palette
    expect(tertiary.main).toEqual('#888')
    expect(tertiary.light).toBeTruthy()
    expect(quaternary.main).toEqual('hsl(0,0,54)')
    expect(quaternary.dark).toBeTruthy()
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
