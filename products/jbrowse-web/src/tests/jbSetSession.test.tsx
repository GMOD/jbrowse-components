import '@testing-library/jest-dom'

import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  findAnyDisplayPainted,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

const config = volvoxConfigWithTracks(['volvox_test_vcf', 'gff3tabix_genes'])

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }

// The session as one document, against the real models: a view keeping its id
// stays the same node, its launch keys are honoured beside its built state (a
// `loc` navigates it, a `{ trackId }` entry in `tracks` opens that track
// through the launcher, with the inline height routed to the display), and
// what the document drops is closed.
test('jb.setSession rewrites the live session as a document', async () => {
  const { view, session } = await createView(config)
  await view.navToLocString('ctgA:1..8000')
  const jb = window.jb!

  const doc = JSON.parse(JSON.stringify(getSnapshot(session))) as {
    views: { loc?: string; tracks: unknown[] }[]
  }
  doc.views[0]!.loc = 'ctgA:20,000-25,000'
  doc.views[0]!.tracks.push({ trackId: 'volvox_test_vcf', height: 77 })
  await jb.setSession(doc, 5000)

  expect(session.views[0]).toBe(view)
  await waitFor(() => {
    expect(view.tracks.map(t => t.configuration.trackId)).toEqual([
      'volvox_test_vcf',
    ])
    expect(view.coarseVisibleLocStrings).toBe('ctgA:19,999..24,999')
  }, delay)
  expect(view.tracks[0]!.activeDisplay.height).toBe(77)
  await findAnyDisplayPainted(delay)

  // an entry for a track already shown restyles it rather than doing nothing
  const restyle = JSON.parse(JSON.stringify(getSnapshot(session))) as {
    views: { tracks: unknown[] }[]
  }
  restyle.views[0]!.tracks.push({ trackId: 'volvox_test_vcf', height: 55 })
  await jb.setSession(restyle, 5000)
  await waitFor(() => {
    expect(view.tracks[0]!.activeDisplay.height).toBe(55)
  }, delay)
  expect(view.tracks).toHaveLength(1)

  const again = JSON.parse(JSON.stringify(getSnapshot(session))) as {
    views: { tracks: unknown[] }[]
  }
  again.views[0]!.tracks = []
  await jb.setSession(again, 5000)
  expect(session.views[0]).toBe(view)
  expect(view.tracks).toHaveLength(0)
}, 90000)

test('jb.addView opens one more view through the launcher, beside the open one', async () => {
  const { view, session } = await createView(config)
  const jb = window.jb!
  const { viewId } = await jb.addView(
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:40,000-50,000',
      tracks: ['gff3tabix_genes'],
      displayName: 'second locus',
    },
    5000,
  )
  expect(session.views.map(v => v.id)).toEqual([view.id, viewId])
  const second = jb.view(viewId)
  expect(second.displayName).toBe('second locus')
  await waitFor(() => {
    expect(second.ownTracks.map(t => t.configuration.trackId)).toEqual([
      'gff3tabix_genes',
    ])
  }, delay)
}, 90000)
