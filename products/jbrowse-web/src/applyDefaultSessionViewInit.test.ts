import { applyDefaultSessionViewInit } from './applyDefaultSessionViewInit.ts'
import { buildLgvInit } from './sessionLoaderHelpers.ts'

import type { InitState } from '@jbrowse/plugin-linear-genome-view'

// the shape applyDefaultSessionViewInit duck-types. A defaultSession view that
// used the `init` shorthand hasn't navigated yet, so assemblyNames (derived from
// displayedRegions) is still empty and only its pending init names an assembly
function makeSession(init?: InitState) {
  const applied: InitState[] = []
  return {
    applied,
    session: {
      views: [
        {
          type: 'LinearGenomeView',
          assemblyNames: [],
          init,
          setInit: (arg: InitState) => applied.push(arg),
        },
      ],
    },
  }
}

// &extendSession=true means "layer onto the defaultSession", but the URL params
// replaced the view's pending init outright, so a config that opened tracks
// through `init.tracks` lost them the moment a URL set `loc`
test('url params layer over a pending init instead of replacing it', () => {
  const { session, applied } = makeSession({
    assembly: 'volvox',
    tracks: ['genes'],
  })

  applyDefaultSessionViewInit(
    session,
    buildLgvInit({ loc: 'ctgB:1-100', assembly: 'volvox' }),
  )

  expect(applied).toEqual([
    { assembly: 'volvox', tracks: ['genes'], loc: 'ctgB:1-100' },
  ])
})

// without &assembly= there was nowhere left to read one from, so the whole init
// — the url's loc included — was dropped with no diagnostic
test('an assembly-less url falls back to the pending init assembly', () => {
  const { session, applied } = makeSession({ assembly: 'volvox' })

  applyDefaultSessionViewInit(session, buildLgvInit({ loc: 'ctgB:1-100' }))

  expect(applied).toEqual([{ assembly: 'volvox', loc: 'ctgB:1-100' }])
})

// the pending init's tracks and loc belong to the assembly it names, so they
// can't ride along into a different one — they'd open tracks whose adapters
// resolve no refNames, which reads as an empty track rather than an error
test('a url that switches assemblies drops the pending init', () => {
  const { session, applied } = makeSession({
    assembly: 'volvox',
    tracks: ['genes'],
    loc: 'ctgA:1-100',
  })

  applyDefaultSessionViewInit(session, buildLgvInit({ assembly: 'volvox2' }))

  expect(applied).toEqual([{ assembly: 'volvox2' }])
})

test('no resolvable assembly applies nothing', () => {
  const { session, applied } = makeSession()

  applyDefaultSessionViewInit(session, buildLgvInit({ loc: 'ctgB:1-100' }))

  expect(applied).toEqual([])
})
