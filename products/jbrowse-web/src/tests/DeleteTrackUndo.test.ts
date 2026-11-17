import { readConfObject } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { doBeforeEach, getTestSession } from './util.tsx'

import type { WebSessionModel } from '../sessionModel/index.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

beforeEach(() => {
  doBeforeEach()
})

const TRACK_ID = 'volvox_gc'

function clickMenuItem(items: MenuItem[], label: string) {
  const item = items.find(i => 'label' in i && i.label === label)
  if (item && 'onClick' in item) {
    item.onClick()
  } else {
    throw new Error(`no ${label} item`)
  }
}

function deleteFromMenu(
  session: WebSessionModel,
  view: LinearGenomeViewModel,
  trackId: string,
) {
  const config = view.tracks.find(
    t => t.configuration.trackId === trackId,
  )!.configuration
  clickMenuItem(session.getTrackActions(config, view), 'Delete track')
}

function clickUndo(session: WebSessionModel, message: string) {
  const snack = session.snackbarMessages.find(m => m.message === message)
  const undo = snack?.actions?.find(a => a.name === 'Undo')
  if (undo) {
    undo.onClick()
  } else {
    throw new Error(`no Undo on "${message}"`)
  }
}

const shownIds = (view: LinearGenomeViewModel) =>
  view.tracks.map(t => t.configuration.trackId)

test("an admin's deleted config track comes back where it was, open where it was", async () => {
  const { session, view } = await getTestSession(undefined, true)
  await view.launchTrack('volvox_filtered_vcf')
  await view.launchTrack(TRACK_ID)
  await view.launchTrack('volvox_cram')
  const shownBefore = getSnapshot(view.tracks[1]!)
  const index = session.jbrowse.tracks.findIndex(t => t.trackId === TRACK_ID)
  const configCount = session.jbrowse.tracks.length
  const name = readConfObject(view.tracks[1]!.configuration, 'name')

  deleteFromMenu(session, view, TRACK_ID)

  expect(session.jbrowse.tracks.some(t => t.trackId === TRACK_ID)).toBe(false)
  expect(shownIds(view)).toEqual(['volvox_filtered_vcf', 'volvox_cram'])

  clickUndo(session, `Deleted ${name}`)

  expect(session.jbrowse.tracks).toHaveLength(configCount)
  expect(session.jbrowse.tracks[index]!.trackId).toBe(TRACK_ID)
  expect(shownIds(view)).toEqual([
    'volvox_filtered_vcf',
    TRACK_ID,
    'volvox_cram',
  ])
  expect(getSnapshot(view.tracks[1]!)).toEqual(shownBefore)
})

test("an admin's edits to a deleted track come back with it", async () => {
  const { session, view } = await getTestSession(undefined, true)
  await view.launchTrack(TRACK_ID)
  session.updateTrackConfiguration({
    ...session.jbrowse.tracks.find(t => t.trackId === TRACK_ID)!,
    name: 'Edited GC',
  })

  deleteFromMenu(session, view, TRACK_ID)
  expect(session.trackConfigDeltas[TRACK_ID]).toBeUndefined()

  clickUndo(session, 'Deleted Edited GC')

  expect(session.tracks.find(t => t.trackId === TRACK_ID)!.name).toBe(
    'Edited GC',
  )
  expect(readConfObject(view.tracks[0]!.configuration, 'name')).toBe(
    'Edited GC',
  )
})

test("a non-admin's deleted session track comes back to the session", async () => {
  const { session, view } = await getTestSession(undefined, false)
  session.addSessionTrackConf({
    ...session.jbrowse.tracks.find(t => t.trackId === TRACK_ID)!,
    trackId: 'my_gc',
    name: 'My GC',
  })
  await view.launchTrack('my_gc')
  const configCount = session.jbrowse.tracks.length

  deleteFromMenu(session, view, 'my_gc')
  expect(session.sessionTracks).toHaveLength(0)
  expect(view.tracks).toHaveLength(0)

  clickUndo(session, 'Deleted My GC')

  expect(session.sessionTracks.map(t => t.trackId)).toEqual(['my_gc'])
  expect(session.jbrowse.tracks).toHaveLength(configCount)
  expect(shownIds(view)).toEqual(['my_gc'])
})
