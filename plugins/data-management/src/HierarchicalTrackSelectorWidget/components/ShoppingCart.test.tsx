import { createJBrowseTheme } from '@jbrowse/core/ui'
import { addMultiTrackMenuItems } from '@jbrowse/core/ui/multiTrackMenuItems'
import { getEnv } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import { setTracksSelected } from '../../FacetedSelector/facetedSelection.ts'
import ShoppingCart from './ShoppingCart.tsx'

import type { HierarchicalTrackSelectorModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

const track = (trackId: string) => ({
  trackId,
  name: trackId,
  assemblyNames: ['volMyt1'],
  type: 'FeatureTrack',
  adapter: { type: 'FromConfigAdapter', features: [] },
})

function openCart() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'ref0',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'a', start: 0, end: 10, seq: 'a' },
        ],
      },
    },
  })
  session.addTrackConf(track('fooC'))
  session.addTrackConf(track('barC'))
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 10 },
    ],
  })
  const model = view.activateTrackSelector() as HierarchicalTrackSelectorModel
  setTracksSelected(model, ['fooC', 'barC'], true, true)
  return { model, pluginManager: getEnv(model).pluginManager }
}

// The model used to reach a contributed row's `onClick` as an argument, which
// the shopping cart supplied by rewrapping each row — untyped, and only over the
// TOP level, so a contributed submenu's children were passed over and would have
// read `undefined`. It now arrives when the items are built, so a row closes over
// it and a nested row is no different from a flat one.
test('a contributed row gets the selector model, nested as well as flat', async () => {
  const { model, pluginManager } = openCart()
  const seen: { where: string; selected: string[]; args: number }[] = []
  addMultiTrackMenuItems(pluginManager, ({ model: cart }) => [
    {
      label: 'Flat row',
      onClick: (...args: unknown[]) => {
        seen.push({
          where: 'flat',
          selected: cart.selection.map(c => `${c.trackId}`),
          args: args.length,
        })
      },
    },
    {
      label: 'Group',
      subMenu: [
        {
          label: 'Nested row',
          onClick: (...args: unknown[]) => {
            seen.push({
              where: 'nested',
              selected: cart.selection.map(c => `${c.trackId}`),
              args: args.length,
            })
          },
        },
      ],
    },
  ])

  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ShoppingCart model={model} />
    </ThemeProvider>,
  )
  fireEvent.click(screen.getByTestId('hts-shopping-cart'))
  fireEvent.click(await screen.findByText('Flat row'))

  fireEvent.click(screen.getByTestId('hts-shopping-cart'))
  fireEvent.click(await screen.findByText('Group'))
  fireEvent.click(await screen.findByText('Nested row'))

  // `args: 0` on both is why the old channel could not have worked for a nested
  // row: the cart rewrapped only top-level rows, and a nested one is invoked by
  // the renderer with nothing — so a contributor that declared
  // `onClick: (model) => …` inside a submenu read `undefined`.
  expect(seen).toEqual([
    { where: 'flat', selected: ['fooC', 'barC'], args: 0 },
    { where: 'nested', selected: ['fooC', 'barC'], args: 0 },
  ])
})
