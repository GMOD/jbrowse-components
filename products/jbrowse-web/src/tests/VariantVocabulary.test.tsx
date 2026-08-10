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
  hideFeature: (id: string) => void
  trackMenuItems: () => VocabMenuItem[]
}

// Where the variant display's `featureNoun` override does and doesn't reach the
// menu. It names *content* — a sentence counting what the track holds — but not
// the *controls*: "Variant height" reads like a different setting than "Feature
// height" when it is the same one, and a reader already understands a feature is
// just a thing. The variant display borrows the canvas menus wholesale, so
// without this both halves could drift with every other variant test green.
function labelsIn(items: VocabMenuItem[]): string[] {
  return items.flatMap(item => [
    ...(item.label === undefined ? [] : [item.label]),
    ...labelsIn(item.subMenu ?? []),
  ])
}

test('the variant track menu names controls generically, content by its noun', async () => {
  const { view } = await createView(config)

  await view.navToLocString('ctgA:1..50000')
  fireEvent.click(await screen.findByTestId(hts('volvox_test_vcf'), ...opts))
  const feature = await findAnyDisplayPainted(delay)
  expect(feature).toBeTruthy()

  const display = view.tracks[0]!.displays[0] as NounDisplay
  expect(display.featureNoun).toBe('variant')

  const labels = labelsIn(display.trackMenuItems())

  // the controls read the same on a variant track as on a gene track
  expect(labels).toEqual(
    expect.arrayContaining([
      'Labels',
      'Set feature height',
      'Fixed feature height + fixed track height',
      'Fit feature height to track height',
    ]),
  )

  // ...and no control row is renamed by the noun
  expect(labels.filter(l => /variant/i.test(l))).toEqual([])
})

test('a row that counts what the track holds still says "variant"', async () => {
  const { view } = await createView(config)

  await view.navToLocString('ctgA:1..50000')
  fireEvent.click(await screen.findByTestId(hts('volvox_test_vcf'), ...opts))
  await findAnyDisplayPainted(delay)

  const display = view.tracks[0]!.displays[0] as NounDisplay
  // the recovery row only exists once something is hidden, and it is a sentence
  // about the track's contents rather than the name of a setting
  display.hideFeature('test-vcf-1')
  expect(labelsIn(display.trackMenuItems())).toEqual(
    expect.arrayContaining(['Show 1 hidden variant']),
  )
})
