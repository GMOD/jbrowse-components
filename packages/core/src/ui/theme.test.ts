import { createJBrowseTheme } from './theme'

test('can create a default theme', () => {
  const theme = createJBrowseTheme()
  const { primary, secondary, tertiary, quaternary } = theme.palette
  expect(primary.main).toEqual('#0D233F')
  expect(secondary.main).toEqual('#721E63')
  expect(tertiary.main).toEqual('#135560')
  expect(quaternary.main).toEqual('#FFB11D')
})
test('allows overriding primary and secondary colors', () => {
  const theme = createJBrowseTheme({
    palette: {
      primary: { main: '#888888' },
      secondary: { main: 'rgb(137,137,137)' },
    },
  })
  expect(theme.palette.primary.main).toEqual('#888888')
  expect(theme.palette.secondary.main).toEqual('rgb(137,137,137)')
})
test('allows overriding tertiary and quaternary colors', () => {
  const theme = createJBrowseTheme({
    palette: {
      tertiary: { 500: '#888' },
      quaternary: { main: 'hsl(0,0,54)' },
    },
  })
  const { tertiary, quaternary } = theme.palette
  expect(tertiary.main).toEqual('#888')
  expect(tertiary.light).toBeTruthy()
  expect(quaternary.main).toEqual('hsl(0,0,54)')
  expect(quaternary.dark).toBeTruthy()
})
test('allows customizing spacing', () => {
  const defaultTheme = createJBrowseTheme()
  expect(defaultTheme.spacing(1)).toBe('4px')
  const biggerSpacingTheme = createJBrowseTheme({ spacing: 16 })
  expect(biggerSpacingTheme.spacing(1)).toBe('16px')
})

test('allows adding a custom override', () => {
  const muiPaperStyle = {
    styleOverrides: { root: { backgroundColor: 'green' } },
  }
  const theme = createJBrowseTheme({
    components: { MuiPaper: muiPaperStyle },
  })
  expect(theme.components?.MuiPaper).toEqual(muiPaperStyle)
})

test('allows modifying a default override', () => {
  const muiButtonStyle = {
    styleOverrides: { textSecondary: 'orange' },
  }
  const theme = createJBrowseTheme({
    components: { MuiButton: muiButtonStyle },
  })
  expect(theme.components?.MuiButton?.styleOverrides?.textSecondary).toEqual(
    muiButtonStyle.styleOverrides.textSecondary,
  )
})

test('allows adding a custom prop', () => {
  const muiPaperProps = { defaultProps: { variant: 'outlined' as const } }
  const theme = createJBrowseTheme({ components: { MuiPaper: muiPaperProps } })
  expect(theme.components?.MuiPaper?.defaultProps).toEqual(
    muiPaperProps.defaultProps,
  )
})

test('allows modifying a prop override', () => {
  const muiButtonProps = { defaultProps: { size: 'medium' as const } }
  const theme = createJBrowseTheme({
    components: { MuiButton: muiButtonProps },
  })
  expect(theme.components?.MuiButton?.defaultProps).toEqual(
    muiButtonProps.defaultProps,
  )
})
