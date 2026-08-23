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

import type { LegendItem } from '@jbrowse/core/ui'

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
  colorLegend: LegendItem[]
  showLegend: boolean
  setShowLegend: (value: boolean) => void
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
  expect(display.colorLegend).toEqual([])

  display.setFeatureColor('jexl:impactColor(feature)')
  expect(display.colorLegend.map(i => i.label)).toEqual([
    'HIGH',
    'MODERATE',
    'LOW',
    'MODIFIER',
  ])
  expect(await screen.findByText('MODERATE', ...opts)).toBeInTheDocument()

  display.setShowLegend(false)
  await waitFor(() => {
    expect(screen.queryByText('MODERATE')).not.toBeInTheDocument()
  }, delay)

  display.setShowLegend(true)
  expect(await screen.findByText('MODERATE', ...opts)).toBeInTheDocument()
}, 60000)
