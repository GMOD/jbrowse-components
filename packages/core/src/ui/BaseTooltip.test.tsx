import { render } from '@testing-library/react'

import BaseTooltip from './BaseTooltip.tsx'

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
