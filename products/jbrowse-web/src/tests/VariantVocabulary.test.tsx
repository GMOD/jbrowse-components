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

interface VocabMenuItem {
  label?: string
  type?: string
  subMenu?: VocabMenuItem[]
}
interface NounDisplay {
  featureNoun: string
  trackMenuItems: () => VocabMenuItem[]
}

// Every label the canvas base builds reads its noun from one `featureNoun`
// getter, and LinearVariantDisplay overrides it. This is the test that the
// override actually reaches the rendered menu: the variant display borrows the
// canvas display's menus wholesale, so without it the vocabulary could silently
// revert to the gene-oriented "feature" with every other variant test green.
function labelsIn(items: VocabMenuItem[]): string[] {
  return items.flatMap(item => [
    ...(item.label === undefined ? [] : [item.label]),
    ...labelsIn(item.subMenu ?? []),
  ])
}

test('the variant track menu says "variant", never "feature"', async () => {
  const user = userEvent.setup()
  const { view, findAllByTestId } = await createView()

  await view.navToLocString('ctgA:1..50000')
  await user.click(await screen.findByTestId(hts('volvox_test_vcf'), ...opts))
  await findAllByTestId(/^display-.*-done$/, ...opts)

  const display = view.tracks[0]!.displays[0] as NounDisplay
  expect(display.featureNoun).toBe('variant')

  const labels = labelsIn(display.trackMenuItems())

  // the two entries the noun renames, and the track-sizing rows underneath the
  // second (which take the noun from the same getter, via heightModeMenuItems)
  expect(labels).toEqual(
    expect.arrayContaining([
      'Variant labels',
      'Variant height',
      'Fixed variant height + fixed track height',
      'Fit variant height to track height',
    ]),
  )

  // no gene vocabulary anywhere in the menu, at any nesting depth. Matched
  // case-insensitively so a sentence-cased leak ("Feature height") is caught
  // alongside a mid-sentence one.
  expect(labels.filter(l => /feature/i.test(l))).toEqual([])
}, 60000)
