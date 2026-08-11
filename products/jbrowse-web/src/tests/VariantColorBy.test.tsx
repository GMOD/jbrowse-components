import '@testing-library/jest-dom'

import { fireEvent, screen, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  findAnyDisplayPainted,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

import type { CanvasColorLegend } from '@jbrowse/plugin-canvas'

setup()

// only the track this suite opens, so createView doesn't mount a
// selector row for the other ~120 - see volvoxConfigWithTracks
const config = volvoxConfigWithTracks(['volvox_test_vcf'])

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay] as const

interface ColorMenuItem {
  label: string
  subMenu?: ColorMenuItem[]
}
interface VariantDisplay {
  featureColor: string
  colorByMode: string
  setFeatureColor: (arg?: string) => void
  colorMenuItems: () => ColorMenuItem[]
  // the canvas hook's real type, not a local restatement of it. This member was
  // hand-declared as `{ items; dismiss() }` and went on compiling after the hook
  // dropped `dismiss` for `dismissed`/`setDismissed`, so the rename reached CI as
  // a runtime TypeError in this file rather than a type error in the package that
  // made it. The rest of the shape stays duck-typed on purpose — the display's own
  // model type is not importable across the lazy boundary.
  colorLegend: CanvasColorLegend | undefined
}

// LinearVariantDisplay collapses the inherited "Color" + "Color by..." pair into
// a single "Color by..." entry (no UTR picker, no strand option) and a solid
// color set through it must flow to the model.
test('variant display exposes one "Color by..." menu and applies a solid color', async () => {
  const { view } = await createView(config)

  await view.navToLocString('ctgA:1..50000')
  fireEvent.click(await screen.findByTestId(hts('volvox_test_vcf'), ...opts))
  await findAnyDisplayPainted(delay)

  const display = view.tracks[0]!.displays[0] as VariantDisplay

  const colorItems = display.colorMenuItems()
  expect(colorItems.map(item => item.label)).toEqual(['Color by...'])
  expect(colorItems[0]!.subMenu?.map(item => item.label)).toEqual([
    'Solid color...',
    'Consequence impact',
    'SV type',
    'Attribute...',
  ])

  expect(display.colorByMode).toBe('solid')
  display.setFeatureColor('red')
  expect(display.featureColor).toBe('red')
  expect(display.colorByMode).toBe('solid')
}, 60000)

// The variant display has no component of its own — it registers the canvas
// feature display's, and its color key reaches the screen through the canvas
// base's `colorLegend` model hook. So this is the test that the borrowed
// component + hook actually draw variant-specific chrome; without it the legend
// could silently stop rendering with every other variant test still green.
test('the consequence-impact color key renders, and dismissing it stops it drawing', async () => {
  const { view } = await createView(config)

  await view.navToLocString('ctgA:1..50000')
  fireEvent.click(await screen.findByTestId(hts('volvox_test_vcf'), ...opts))
  await findAnyDisplayPainted(delay)

  const display = view.tracks[0]!.displays[0] as VariantDisplay
  expect(display.colorLegend).toBeUndefined()

  display.setFeatureColor('jexl:impactColor(feature)')
  expect(display.colorLegend?.items.map(i => i.label)).toEqual([
    'HIGH',
    'MODERATE',
    'LOW',
    'MODIFIER',
  ])
  expect(await screen.findByText('MODERATE', ...opts)).toBeInTheDocument()

  // The hook stays PRESENT once dismissed and reports `dismissed` instead of
  // vanishing, which is the whole point of the change that made it a flag: the
  // key's own "×" was the only control that could put it away and it went away
  // with the key, so a dismissal lasted until reload. Something has to still see
  // the key to offer it back — the "Show legend" checkbox reads exactly this.
  display.colorLegend!.setDismissed(true)
  expect(display.colorLegend!.dismissed).toBe(true)
  await waitFor(() => {
    expect(screen.queryByText('MODERATE')).not.toBeInTheDocument()
  }, delay)

  // and back, since a one-way door is the bug this replaced
  display.colorLegend!.setDismissed(false)
  expect(await screen.findByText('MODERATE', ...opts)).toBeInTheDocument()
}, 60000)
