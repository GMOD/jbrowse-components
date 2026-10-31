import '@testing-library/jest-dom'

import { fireEvent, screen } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  findAnyDisplayPainted,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

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

interface VocabMenuItem {
  label?: string
  type?: string
  subMenu?: VocabMenuItem[]
}
interface NounDisplay {
  featureNoun: string
  trackMenuItems: () => VocabMenuItem[]
}

// Where the variant display's `featureNoun` reaches the menu. It names
// *content* (the record details row, a row waiting on records in view) but not
// the *controls*: "Variant height" reads like a different setting than
// "Feature height" when it is the same one, and a reader already understands a
// feature is just a thing.
function labelsIn(items: VocabMenuItem[]): string[] {
  return items.flatMap(item => [
    ...(item.label === undefined ? [] : [item.label]),
    ...labelsIn(item.subMenu ?? []),
  ])
}

test('the variant track menu names its controls generically', async () => {
  const { view } = await createView(config)

  await view.navToLocString('ctgA:1..50000')
  fireEvent.click(await screen.findByTestId(hts('volvox_test_vcf'), ...opts))
  const feature = await findAnyDisplayPainted(delay)
  expect(feature).toBeTruthy()

  const display = view.tracks[0]!.displays[0] as NounDisplay &
    LinearDisplayModel
  expect(display.featureNoun).toBe('variant')

  const labels = labelsIn(display.trackMenuItems())
  expect(labels).toEqual(
    expect.arrayContaining(['Show', 'Records', 'Color by']),
  )

  // ...and no control row is renamed by the noun
  expect(labels.filter(l => /variant/i.test(l))).toEqual([])
})
