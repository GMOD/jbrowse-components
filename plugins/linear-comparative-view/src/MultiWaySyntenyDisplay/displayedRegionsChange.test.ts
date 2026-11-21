import { SimpleFeature } from '@jbrowse/core/util'
import { testAssembly } from '@jbrowse/display-test-utils'

import { createDisplayWithSession } from './testEnv.ts'

// The ortholog records were fetched for the displayed regions, so a jump to
// another contig drops them at once and the display reads loading until the
// new contig's records land, rather than holding the old contig's frame
// through the fetch debounce.

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 }
const ctgB = { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 1000 }

function pair(refName: string) {
  return new SimpleFeature({
    uniqueId: `pair-${refName}`,
    refName,
    start: 100,
    end: 700,
    strand: 1,
    assemblyName: 'volvox',
    mate: {
      assemblyName: 'volvox_random',
      refName: 'ctgA',
      start: 100,
      end: 700,
    },
  })
}

async function until(condition: () => boolean) {
  for (let i = 0; i < 400 && !condition(); i++) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  expect(condition()).toBe(true)
}

test('a jump to another contig drops the held records until its own land', async () => {
  const pending: (() => void)[] = []
  const { display } = createDisplayWithSession({
    geneTracks: [],
    assemblyOf: () =>
      testAssembly({
        regions: [
          { ...ctgA, end: 50_000 },
          { ...ctgB, end: 50_000 },
        ],
      }),
    rpc: (name, args) => {
      const [region] = (args.regions ?? []) as { refName: string }[]
      return name === 'MultiWayGetFeatures' && region
        ? new Promise(resolve => {
            pending.push(() => {
              resolve([pair(region.refName)])
            })
          })
        : Promise.resolve([])
    },
  })
  await until(() => pending.length === 1)
  pending.shift()!()
  await until(() => display.dataCurrent)
  display.markCanvasDrawn()
  expect(display.features.map(f => f.get('refName'))).toEqual(['ctgA'])
  expect(display.displayPhase).toBe('ready')

  display.lgv.setDisplayedRegions([ctgB])
  expect(display.anchorRecordsLoaded).toBe(false)
  expect(display.displayPhase).toBe('loading')

  await until(() => pending.length === 1)
  expect(display.anchorRecordsLoaded).toBe(false)
  expect(display.displayPhase).toBe('loading')
  pending.shift()!()
  await until(() => display.anchorRecordsLoaded)
  expect(display.features.map(f => f.get('refName'))).toEqual(['ctgB'])
})
