import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { getSession } from '@jbrowse/core/util'
import { getSnapshot, unprotect } from '@jbrowse/mobx-state-tree'

import { highlightSearchResultFeature } from './searchResultHighlight.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { TestDisplay } from './testEnv.ts'

// The stub assembly manager says yes to every refName, under which every
// "ref:start..end" reads as ambiguous (the whole string could be a refName with
// a colon in it). Answer the way a real assembly does: the canonical name and
// its alias, and nothing else.
function setup() {
  const { createDisplay } = createTestEnvironment()
  const env = createDisplay()
  jest
    .spyOn(getSession(env.view).assemblyManager, 'isValidRefName')
    .mockImplementation(refName => refName === 'ctgA' || refName === 'chrA')
  return env
}

function highlightsOf(display: TestDisplay) {
  return getSnapshot(display.featureHighlights)
}

function highlight({
  locString,
  trackId = 'test_track',
}: {
  locString: string
  trackId?: string
}) {
  return new BaseResult({ label: 'EDEN', locString, trackId })
}

describe('highlightSearchResultFeature', () => {
  it('highlights the hit on its track, under the canonical refName', () => {
    const { display, view } = setup()
    highlightSearchResultFeature({
      result: highlight({ locString: 'chrA:1051..3902' }),
      model: view,
      assemblyName: 'volvox',
    })
    expect(highlightsOf(display)).toEqual([
      { refName: 'ctgA', start: 1050, end: 3902, name: 'EDEN' },
    ])
  })

  it('does nothing for a hit that names only a refName', () => {
    const { display, view } = setup()
    highlightSearchResultFeature({
      result: highlight({ locString: 'ctgA' }),
      model: view,
      assemblyName: 'volvox',
    })
    expect(highlightsOf(display)).toEqual([])
  })

  it('does nothing for a hit with no location or no track', () => {
    const { display, view } = setup()
    highlightSearchResultFeature({
      result: new BaseResult({ label: 'EDEN', trackId: 'test_track' }),
      model: view,
      assemblyName: 'volvox',
    })
    highlightSearchResultFeature({
      result: new BaseResult({ label: 'EDEN', locString: 'ctgA:1051..3902' }),
      model: view,
      assemblyName: 'volvox',
    })
    expect(highlightsOf(display)).toEqual([])
  })

  // A malformed coordinate is a parse error, not a miss: the extension point
  // that calls this (PluginManager.evaluateExtensionPoint) catches and logs it,
  // so the app-level effect is "nothing", but a direct caller gets the throw.
  it('throws on coordinates that do not parse', () => {
    const { display, view } = setup()
    expect(() => {
      highlightSearchResultFeature({
        result: highlight({ locString: 'ctgA:abc..def' }),
        model: view,
        assemblyName: 'volvox',
      })
    }).toThrow(/could not parse range/)
    expect(highlightsOf(display)).toEqual([])
  })

  it('leaves a track that is not open alone', () => {
    const { display, view } = setup()
    highlightSearchResultFeature({
      result: highlight({ locString: 'ctgA:1051..3902', trackId: 'other' }),
      model: view,
      assemblyName: 'volvox',
    })
    expect(highlightsOf(display)).toEqual([])
  })

  it('reaches every capable display on the track', () => {
    const { display, view, track, session } = setup()
    unprotect(session)
    track.displays.push({ type: 'LinearBasicDisplay' })
    const second: TestDisplay = track.displays[1]
    highlightSearchResultFeature({
      result: highlight({ locString: 'ctgA:1051..3902' }),
      model: view,
      assemblyName: 'volvox',
    })
    const expected = [{ refName: 'ctgA', start: 1050, end: 3902, name: 'EDEN' }]
    expect(highlightsOf(display)).toEqual(expected)
    expect(highlightsOf(second)).toEqual(expected)
  })
})
