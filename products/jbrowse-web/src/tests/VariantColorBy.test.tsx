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

import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { LinearDisplayModel } from '@jbrowse/display-kit/types'

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
  type?: string
  checked?: boolean
  onClick?: () => void
  subMenu?: ColorMenuItem[]
}
interface VariantDisplay {
  colorEncoding: unknown
  setColorValue: (value: string | undefined) => void
  colorByField: (field: string) => void
  trackMenuItems: () => ColorMenuItem[]
  colorScales: ColorScale[]
  setShowLegend: (value: boolean) => void
}

async function openVariantTrack() {
  const { view } = await createView(config)
  await view.navToLocString('ctgA:1..50000')
  fireEvent.click(await screen.findByTestId(hts('volvox_test_vcf'), ...opts))
  await findAnyDisplayPainted(delay)
  return view.tracks[0]!.displays[0] as VariantDisplay & LinearDisplayModel
}

// A row of the cells' block of the one "Color by" menu. A row needing
// something the fetched window lacks carries the reason after its label,
// hence the prefix.
function cellColorRow(display: VariantDisplay, label: string) {
  const colorBy = display.trackMenuItems().find(i => i.label === 'Color by')
  return colorBy!.subMenu!.find(
    item => item.type === 'radio' && item.label.startsWith(label),
  )!
}

test('the variant display\'s "Color by" picks what the cells paint, a solid color included', async () => {
  const display = await openVariantTrack()

  expect(cellColorRow(display, 'Genotype').checked).toBe(true)
  display.setColorValue('red')
  expect(display.colorEncoding).toBe('red')
  expect(cellColorRow(display, 'Solid color...').checked).toBe(true)
  expect(cellColorRow(display, 'Genotype').checked).toBe(false)

  cellColorRow(display, 'Consequence impact').onClick!()
  expect(cellColorRow(display, 'Consequence impact').checked).toBe(true)
  expect(cellColorRow(display, 'Solid color...').checked).toBe(false)
  cellColorRow(display, 'Genotype').onClick!()
  expect(cellColorRow(display, 'Genotype').checked).toBe(true)
  expect(cellColorRow(display, 'Consequence impact').checked).toBe(false)
}, 60000)

// The key reaches the screen through `LegendMixin`'s `colorScales` hook and
// the chrome, so this is the test that the variant display's keys actually
// draw; without it the legend could silently stop rendering with every other
// variant test still green.
test('the consequence-impact color key renders, and dismissing it stops it drawing', async () => {
  const display = await openVariantTrack()
  // the records band's SV classes, then the cells' genotype key
  expect(display.colorScales.map(scale => scale.id)).toEqual([
    'records',
    'genotypes',
  ])

  display.colorByField('impact')
  await waitFor(() => {
    const impact = display.colorScales.find(s => s.id === 'recordField')
    expect(
      impact?.kind === 'categorical' && impact.entries.map(e => e.label),
    ).toEqual(expect.arrayContaining(['HIGH', 'MODERATE', 'LOW', 'MODIFIER']))
  }, delay)
  expect(await screen.findByText('MODERATE', ...opts)).toBeInTheDocument()

  display.setShowLegend(false)
  await waitFor(() => {
    expect(screen.queryByText('MODERATE')).not.toBeInTheDocument()
  }, delay)

  display.setShowLegend(true)
  expect(await screen.findByText('MODERATE', ...opts)).toBeInTheDocument()
}, 60000)
