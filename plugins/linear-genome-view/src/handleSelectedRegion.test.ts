import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import {
  handleSelectedRegion,
  navigateToSelectedOption,
} from './searchUtils.ts'

import type { LinearGenomeViewModel } from './index.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

async function setup() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'seq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'a', start: 0, end: 50_000 },
          { refName: 'ctgB', uniqueId: 'b', start: 0, end: 6000 },
        ],
      },
    },
  })
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 50_000 },
    ],
  }) as LinearGenomeViewModel
  view.setWidth(800)
  await when(() => view.initialized)
  const searchIndexes = jest.spyOn(session.textSearchManager, 'searchIndexes')
  const go = (input: string) =>
    handleSelectedRegion({ input, model: view, assemblyName: 'volMyt1' })
  return { view, searchIndexes, go }
}

test.each([
  ['a refName/start/end triplet', 'ctgA 1001 2000', 'ctgA', 1000, 2000],
  ['an {assembly}-prefixed locstring', '{volMyt1}ctgB:11-20', 'ctgB', 10, 20],
  ['a refName with a trailing colon', 'ctgB:', 'ctgB', 0, 6000],
])(
  '%s navigates without asking the text index',
  async (_, input, refName, start, end) => {
    const { view, searchIndexes, go } = await setup()
    expect(await go(input)).toBe(true)
    expect(searchIndexes).not.toHaveBeenCalled()
    const [region] = view.displayedRegions
    expect(region!.refName).toBe(refName)
    expect(view.pxToBp(0).coord - 1).toBeCloseTo(start, -1)
    expect(view.pxToBp(view.width).coord - 1).toBeCloseTo(end, -1)
  },
)

test('a plain name with no hits is a name miss, after asking the index', async () => {
  const { searchIndexes, go } = await setup()
  await expect(go('nosuchgene')).rejects.toThrow(
    /No results found for "nosuchgene"/,
  )
  expect(searchIndexes).toHaveBeenCalled()
})

test('a coordinate on an unknown refName keeps its ref error', async () => {
  const { go } = await setup()
  await expect(go('chrNope:1-10')).rejects.toThrow(/unknown reference sequence/)
})

test('an {assembly} the session lacks is named in the error', async () => {
  const { go } = await setup()
  await expect(go('{nope}ctgA:1-10')).rejects.toThrow(
    /assembly "nope" could not be resolved/,
  )
})

test('a picked option reports whether the view moved', async () => {
  const { view } = await setup()
  const pick = (option: BaseResult) =>
    navigateToSelectedOption({ option, model: view, assemblyName: 'volMyt1' })
  const hit = (locString: string) =>
    new BaseResult({ label: 'EDEN', locString })

  expect(await pick(hit('ctgA:101..200'))).toBe(true)
  expect(
    await pick(
      new BaseResult({
        label: 'EDEN',
        results: [hit('ctgA:101..200'), hit('ctgB:101..200')],
      }),
    ),
  ).toBe(false)
  expect(view.searchPicker).toBeDefined()
})
