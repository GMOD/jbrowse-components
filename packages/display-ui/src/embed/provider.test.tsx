import { resolvePalette } from '@jbrowse/core/ui/palette'
import { render, screen } from '@testing-library/react'

import { useChromeOverlayOverride } from '../chromeOverlayContext.ts'
import plainChromeOverlays from '../plainChromeOverlays.tsx'
import { useTrackControlOverride } from '../trackControl/trackControlContext.ts'
import { EmbedProvider } from './provider.tsx'

import type { EmbedChrome } from './provider.tsx'

const session = {
  palette: resolvePalette(),
  setThemeMode() {},
  snackbarMessages: [],
  queueOfDialogs: [],
  popSnackbarMessage() {},
  removeActiveDialog() {},
}

function Probe() {
  const overlays = useChromeOverlayOverride()
  const control = useTrackControlOverride()
  return (
    <span data-testid="probe">
      {overlays === undefined
        ? 'stock'
        : overlays.Loading === plainChromeOverlays.Loading
          ? 'plain'
          : 'custom'}{' '}
      {control === undefined ? 'stock' : 'set'}
    </span>
  )
}

function drawn(chrome: EmbedChrome) {
  render(
    <EmbedProvider session={session} {...chrome}>
      <Probe />
    </EmbedProvider>,
  )
  return screen.getByTestId('probe').textContent
}

test('the default chrome is the plain set', () => {
  expect(drawn({})).toBe('plain set')
})

test('overlays replace parts of the plain set', () => {
  expect(drawn({ overlays: { Loading: () => null } })).toBe('custom set')
})

test('material installs nothing, so a stock display binds its own chrome', () => {
  expect(drawn({ chrome: 'material' })).toBe('stock stock')
})
