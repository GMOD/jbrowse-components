import PluginManager from '@jbrowse/core/PluginManager'

import { BaseSessionModel } from './BaseSession.ts'

function makeSession(snapshot: Record<string, unknown> = {}) {
  return BaseSessionModel(new PluginManager()).create({
    name: 'test',
    ...snapshot,
  })
}

const region = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 }

test('adding a highlight shows the bands, removing one leaves them off', () => {
  const session = makeSession()
  session.setHighlightsVisible(false)
  session.addHighlight(region)
  expect(session.highlightsVisible).toBe(true)

  session.setHighlightsVisible(false)
  session.removeHighlight(session.highlights[0]!)
  expect(session.highlights).toEqual([])
  expect(session.highlightsVisible).toBe(false)
})

// the list is listed with the bands off, so a color picked there has to bring
// them back or nothing appears to happen
test('recoloring shows the bands and replaces the entry in place', () => {
  const session = makeSession()
  session.addHighlight(region)
  session.addHighlight({ ...region, start: 200, end: 300 })
  session.setHighlightsVisible(false)
  session.updateHighlight(session.highlights[0]!, { color: 'red' })
  expect(session.highlights.map(h => h.color)).toEqual(['red', undefined])
  expect(session.highlightsVisible).toBe(true)
})

test('an identical highlight is not added twice', () => {
  const session = makeSession()
  session.addHighlight(region)
  session.addHighlight({ ...region })
  session.addHighlight({ ...region, label: 'labelled' })
  expect(session.highlights).toHaveLength(2)
})

test('restoring a session keeps its bands off', () => {
  const session = makeSession({
    highlights: [region],
    highlightsVisible: false,
  })
  expect(session.highlights).toHaveLength(1)
  expect(session.highlightsVisible).toBe(false)
})
