import '@testing-library/jest-dom'

import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import {
  createView,
  doBeforeEach,
  findAnyDisplayPainted,
  hts,
  setup,
} from './util.tsx'

setup()

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
  colorLegend: { items: { label: string }[]; dismiss: () => void } | undefined
}

// LinearVariantDisplay collapses the inherited "Color" + "Color by..." pair into
// a single "Color by..." entry (no UTR picker, no strand option) and a solid
// color set through it must flow to the model.
test('variant display exposes one "Color by..." menu and applies a solid color', async () => {
  const user = userEvent.setup()
  const { view } = await createView()

  await view.navToLocString('ctgA:1..50000')
  await user.click(await screen.findByTestId(hts('volvox_test_vcf'), ...opts))
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
test('the consequence-impact color key renders, and dismissing it removes it', async () => {
  const user = userEvent.setup()
  const { view } = await createView()

  await view.navToLocString('ctgA:1..50000')
  await user.click(await screen.findByTestId(hts('volvox_test_vcf'), ...opts))
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

  display.colorLegend!.dismiss()
  expect(display.colorLegend).toBeUndefined()
  await waitFor(() => {
    expect(screen.queryByText('MODERATE')).not.toBeInTheDocument()
  }, delay)
}, 60000)
