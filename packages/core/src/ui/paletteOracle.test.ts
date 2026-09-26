import { resolvePalette } from './palette.ts'
import { createJBrowseThemeFromArgs, defaultThemes } from './theme.ts'

/**
 * Every built-in theme resolved to its last colour, so a change to how a
 * palette is *assembled* has to say which pixels it moved. Splitting light from
 * dark, folding two presets into one with a `dark` block, adding a mode
 * argument: none of those is supposed to repaint anything, and the diff here is
 * the only thing that can tell you whether it did.
 *
 * Update with `-u` when a colour change is the point.
 */
// Named rather than read off `defaultThemes`, because the retired names are
// exactly what a shrinking `defaultThemes` would stop covering — and a stored
// selection, a share link and `jbrowse-img --theme` still carry them.
const NAMES = [
  ...Object.keys(defaultThemes),
  'lightStock',
  'darkStock',
  'lightMinimal',
  'darkMinimal',
]

test.each(NAMES)('%s resolves the same colours', name => {
  expect(resolvePalette({ themeName: name })).toMatchSnapshot()
})

// The `default` theme is the one that merges the config `theme` slot, in both
// modes, so it needs its own rows.
test.each([
  ['a config brand', { palette: { primary: { main: '#8b0000' } } }],
  [
    'a config brand, dark',
    { palette: { primary: { main: '#8b0000' }, mode: 'dark' } },
  ],
  ['a bare mode', { palette: { mode: 'dark' } }],
  ['a config background', { palette: { background: { paper: '#fafafa' } } }],
] as const)('default + %s resolves the same colours', (_name, configTheme) => {
  expect(
    resolvePalette({ themeName: 'default', configTheme }),
  ).toMatchSnapshot()
})

// The MUI half, which the palette oracle cannot see: `darkStock` alone turns on
// `enableColorOnDark` today, so its AppBar keeps the brand where every other
// dark theme flattens to the paper colour. Whether that stays true of a palette
// drawn dark is a decision, and this is what makes it one.
test.each(NAMES)('%s builds the same chrome', name => {
  const theme = createJBrowseThemeFromArgs({ themeName: name })
  expect({
    mode: theme.palette.mode,
    primary: theme.palette.primary.main,
    appBarColorOnDark:
      theme.components?.MuiAppBar?.defaultProps?.enableColorOnDark ?? false,
  }).toMatchSnapshot()
})
