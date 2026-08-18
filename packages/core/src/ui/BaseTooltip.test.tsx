import { render } from '@testing-library/react'

import BaseTooltip from './BaseTooltip.tsx'
import { StyleThemeProvider } from './PaletteContext.tsx'
import { resolveStyleTheme } from './styleTheme.ts'

// The tooltip is the one piece of display chrome that is not behind either
// bring-your-own provider: a display renders it directly, so an embedder cannot
// swap it. That makes its own look load-bearing for
// `products/jbrowse-build-your-own`'s claim that stock displays render no
// Material UI, and it is exactly the shape that claim's smoke census cannot
// see -- an emotion class carries no `Mui*` in its name, so a tooltip styled
// from the MUI *default* theme (which is what a host with no ThemeProvider
// gets) counted as zero.
//
// So it is pinned here instead, deterministically, rather than left to a hover
// in a headless browser that may or may not land on a feature.
//
// What it *imports* is pinned separately, in `util/tss-react/muiFree.test.ts`:
// this file can only see what reaches the DOM, and the failure that motivated
// that guard reached none of it. `Portal` renders no element to carry a class
// and `fontFamily: inherit` defeats the Roboto fingerprint, so a Material
// component sat in this module for months with every check green.

test('styles itself inline, with no emotion or Mui class to carry a theme', () => {
  const { getByText } = render(<BaseTooltip>ctgA:1..100</BaseTooltip>)

  const tip = getByText('ctgA:1..100')
  expect(tip.className).toBe('')
  expect(tip.style.backgroundColor).toBe('rgba(97, 97, 97, 0.9)')
  expect(tip.style.color).toBe('rgb(255, 255, 255)')
})

// Material UI's default typography is `Roboto, Helvetica, Arial, sans-serif`,
// and a tooltip that stated it landed a font the embedding page never loaded on
// top of their own. Inheriting puts it in whatever it is portaled into --
// Roboto in JBrowse's products, whose CssBaseline sets the body font.
test('inherits the host font rather than naming one', () => {
  const { getByText } = render(<BaseTooltip>ctgA:1..100</BaseTooltip>)

  expect(getByText('ctgA:1..100').style.fontFamily).toBe('inherit')
})

// floating-ui's positioning has to win over the base style, or the tooltip
// lands wherever the document flow put the portal instead of at the cursor.
test('the floating strategy positions it, not the base style', () => {
  const { getByText } = render(
    <BaseTooltip clientPoint={{ x: 10, y: 20 }}>ctgA:1..100</BaseTooltip>,
  )

  expect(getByText('ctgA:1..100').style.position).toBe('fixed')
})

// The second anchoring: hung off an element rather than following the pointer,
// which is what a control's hover label wants. `@jbrowse/display-ui`'s
// `useTooltip` supplies the hover and the dismissal and drives this arm; the box
// is this component either way, so the two cannot drift apart in look, portal
// target or z-index.
test('anchors to an element, and names itself for aria-describedby', () => {
  const anchor = document.createElement('button')
  document.body.append(anchor)

  const { getByText } = render(
    <BaseTooltip id="tip-1" anchor={anchor}>
      Hide legend
    </BaseTooltip>,
  )

  const tip = getByText('Hide legend')
  expect(tip.id).toBe('tip-1')
  expect(tip.getAttribute('role')).toBe('tooltip')
  expect(tip.style.position).toBe('fixed')
})

// The tooltip has to leave its track's `contain: strict` box, so it portals.
// `document.body` is the default, which is what MUI's `Portal` gave it before
// the toolkit came out of this file.
test('portals to document.body when no container is configured', () => {
  const { getByText } = render(<BaseTooltip>ctgA:1..100</BaseTooltip>)

  expect(getByText('ctgA:1..100').closest('body')).toBe(document.body)
})

// A shadow-DOM embed states its container once, on the same config slot MUI's
// own portaled components read (`components.MuiPopper.defaultProps.container`),
// and `resolveStyleTheme` lifts it onto the style theme so reading it here
// costs no UI toolkit. It is a *function* because the root does not exist when
// the config is built, which is the arm that actually gets used.
test('portals into the container a shadow-DOM host configured', () => {
  const host = document.createElement('div')
  document.body.append(host)
  const theme = resolveStyleTheme({
    configTheme: {
      components: { MuiPopper: { defaultProps: { container: () => host } } },
    },
  })

  const { getByText } = render(
    <StyleThemeProvider theme={theme}>
      <BaseTooltip>ctgA:1..100</BaseTooltip>
    </StyleThemeProvider>,
  )

  expect(host.contains(getByText('ctgA:1..100'))).toBe(true)
})

// The container is a fact about where the app is mounted, not about how it
// looks, so a preset must not take it away — `resolveStyleTheme` merges presets
// over `configTheme` for sizing, and reading the container from that merge
// would drop it for any embed that also picks a named theme.
test('a named theme does not lose the configured container', () => {
  const host = document.createElement('div')
  const theme = resolveStyleTheme({
    themeName: 'lightStock',
    extraThemes: { lightStock: {} },
    configTheme: {
      components: { MuiPopper: { defaultProps: { container: () => host } } },
    },
  })

  expect(typeof theme.portalContainer).toBe('function')
})
