import './svgExportMocks.ts'

import { fireEvent, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  exportAndVerifySvg,
  findAnyDisplayPainted,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

jest.mock('@jbrowse/core/util/FileSaver', () => ({ saveAs: jest.fn() }))

setup()

// only the track this suite opens, so createView doesn't mount a
// selector row for the other ~120 - see volvoxConfigWithTracks
const config = volvoxConfigWithTracks(['gff3tabix_genes'])

beforeEach(() => {
  jest.clearAllMocks()
  doBeforeEach()
})

const delay = { timeout: 40000 }
const opts = [{}, delay]

test('export svg of reversed region with gene labels', async () => {
  const { view, findByTestId, findByText } = await createView(config)

  await view.navToLocString('ctgA:1..7,720[rev]', 'volvox')

  await waitFor(
    () => {
      expect(view.displayedRegions[0]?.reversed).toBe(true)
    },
    { timeout: 10000 },
  )

  fireEvent.click(await findByTestId(hts('gff3tabix_genes'), ...opts))
  await waitFor(() => {
    expect(view.tracks.length).toBe(1)
  })
  const display = view.tracks[0]!.displays[0] as {
    setHeightMode: (mode: string) => void
  }
  display.setHeightMode('fixed')

  await findAnyDisplayPainted({ timeout: 30000 })

  await exportAndVerifySvg({
    findByTestId,
    findByText,
    filename: 'reversed_region_labels',
    delay,
  })
}, 60000)
