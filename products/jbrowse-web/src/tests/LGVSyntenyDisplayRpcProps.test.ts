import { createTestSessionAsync } from '../rootModel/test_util.ts'

jest.mock('../makeWorkerInstance', () => () => {})

// LGVSyntenyDisplay overrides the alignments display's `rpcProps` to add the
// detail tier. These specs drive the real composed model rather than the pure
// `resolveDisplayLodMode` helper, because the helper was never the fragile part
// — both bugs it has had were in the wiring around it. It captures the base
// `rpcProps` as a bare function, so a base that read a sibling view off `this`
// threw on every fetch; and it read the threshold from a source that silently
// omits defaults, so the tier was never sent for a default-configured track.
async function syntenyDisplay(adapter: Record<string, unknown>) {
  const session = await createTestSessionAsync({
    jbrowseConfig: {
      assemblies: [
        {
          name: 'volvox',
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: 'volvox_refseq',
            adapter: {
              type: 'FromConfigSequenceAdapter',
              features: [
                {
                  refName: 'ctgA',
                  uniqueId: 'firstId',
                  start: 0,
                  end: 100,
                  seq: 'A'.repeat(100),
                },
              ],
            },
          },
        },
      ],
      tracks: [
        {
          type: 'SyntenyTrack',
          trackId: 'volvox_synteny',
          assemblyNames: ['volvox', 'volvox_random'],
          adapter,
          displays: [
            {
              type: 'LGVSyntenyDisplay',
              displayId: 'volvox_synteny-LGVSyntenyDisplay',
            },
          ],
        },
      ],
    },
    sessionSnapshot: {
      views: [
        {
          id: 'view1',
          type: 'LinearGenomeView',
          tracks: [
            {
              id: 'track1',
              type: 'SyntenyTrack',
              configuration: 'volvox_synteny',
              displays: [{ id: 'display1', type: 'LGVSyntenyDisplay' }],
            },
          ],
        },
      ],
    },
  })
  const view = session.views[0] as { bpPerPx: number }
  // displays[0] is `any`, so annotate to keep phantom getters from typechecking
  const display = session.views[0].tracks[0].displays[0] as {
    rpcProps: () => Record<string, unknown>
    hasLodCapableAdapter: boolean
    setLodMode: (arg: 'auto' | 'fine' | 'coarse') => void
    trackMenuItems: () => { label?: string }[]
  }
  return { view, display }
}

// A view with no displayed regions sits at bpPerPx 1 and clamps any zoom back to
// it, so the tier is exercised by straddling that value with the threshold
// rather than by zooming. That the two tiered cases below differ at all is the
// proof that the view's bpPerPx is what reaches the comparison.
function tiered(coarseBpPerPxThreshold?: number) {
  return {
    type: 'AllVsAllIndexedPAFAdapter',
    pifGzLocation: { uri: 'nonexistent.pif.gz', locationType: 'UriLocation' },
    index: {
      location: { uri: 'nonexistent.pif.gz.tbi', locationType: 'UriLocation' },
    },
    assemblyNames: ['volvox', 'volvox_random'],
    ...(coarseBpPerPxThreshold === undefined ? {} : { coarseBpPerPxThreshold }),
  }
}

const UNTIERED = { type: 'FromConfigAdapter', features: [] }

test('the override still carries the inherited alignments fields', async () => {
  const { display } = await syntenyDisplay(tiered())
  // sortTag is the one the base reads off a sibling view, so it is the field
  // that regressed; the rest pin that nothing else was dropped by the override.
  // Keys, not values: sortTag and colorBy are legitimately undefined here (the
  // synteny default scheme is 'strand', which the shader decides on its own, so
  // workerColorBy projects it away), and toMatchObject would pass on a dropped
  // key just as happily as on a present-but-undefined one.
  expect(Object.keys(display.rpcProps())).toEqual(
    expect.arrayContaining([
      'sortTag',
      'filterBy',
      'colorBy',
      'showSoftClipping',
      'showCoverage',
      'linkedReads',
    ]),
  )
  expect(display.rpcProps()).toMatchObject({
    sortTag: undefined,
    colorBy: undefined,
    filterBy: expect.anything(),
    showSoftClipping: expect.any(Boolean),
    showCoverage: expect.any(Boolean),
    linkedReads: expect.any(String),
  })
})

// the regression that made the whole feature a no-op: the threshold slot carries
// a schema default (10000), and reading it from a source that omits defaults
// left it undefined, which resolves to no lodMode at all
test('a threshold left at its schema default still yields a tier', async () => {
  const { view, display } = await syntenyDisplay(tiered())
  expect(view.bpPerPx).toBe(1)
  expect(display.rpcProps().lodMode).toBe('fine')
})

test('a threshold below the current bpPerPx asks for the coarse tier', async () => {
  const { view, display } = await syntenyDisplay(tiered(0.5))
  expect(view.bpPerPx).toBe(1)
  expect(display.rpcProps().lodMode).toBe('coarse')
})

// An untiered adapter has only the fine tier to serve, so that is the honest
// answer at any zoom — and, having no threshold slot, it is also the reason the
// "Level of detail" menu stays hidden for it
test('an adapter with no coarse tier asks for the fine tier and offers no menu', async () => {
  const { display } = await syntenyDisplay(UNTIERED)
  expect(display.rpcProps().lodMode).toBe('fine')
  expect(display.hasLodCapableAdapter).toBe(false)
})

test('a tiered adapter offers the level-of-detail menu', async () => {
  const { display } = await syntenyDisplay(tiered())
  expect(display.hasLodCapableAdapter).toBe(true)
  expect(display.trackMenuItems().map(i => i.label)).toContain(
    'Level of detail',
  )
})

// The bug this whole resolution point exists for: pinning a tier must move the
// value that goes into rpcProps, which is the refetch cache key
test('pinning a tier overrides the zoom-based answer', async () => {
  const { display } = await syntenyDisplay(tiered(0.5))
  expect(display.rpcProps().lodMode).toBe('coarse')
  display.setLodMode('fine')
  expect(display.rpcProps().lodMode).toBe('fine')
})
