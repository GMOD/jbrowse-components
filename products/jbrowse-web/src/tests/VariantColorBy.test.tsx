import '@testing-library/jest-dom'

import { screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { createView, doBeforeEach, hts, setup } from './util.tsx'

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
}

// LinearVariantDisplay collapses the inherited "Color" + "Color by..." pair into
// a single "Color by..." entry (no UTR picker, no strand option) and a solid
// color set through it must flow to the model.
test('variant display exposes one "Color by..." menu and applies a solid color', async () => {
  const user = userEvent.setup()
  const { view, findAllByTestId } = await createView()

  await view.navToLocString('ctgA:1..50000')
  await user.click(await screen.findByTestId(hts('volvox_test_vcf'), ...opts))
  await findAllByTestId(/^display-.*-done$/, ...opts)

  const display = view.tracks[0]!.displays[0] as VariantDisplay

  const colorItems = display.colorMenuItems()
  expect(colorItems.map(item => item.label)).toEqual(['Color by...'])
  expect(colorItems[0]!.subMenu?.map(item => item.label)).toEqual([
    'Solid color...',
    'Consequence impact',
    'Attribute...',
  ])

  expect(display.colorByMode).toBe('solid')
  display.setFeatureColor('red')
  expect(display.featureColor).toBe('red')
  expect(display.colorByMode).toBe('solid')
}, 60000)
