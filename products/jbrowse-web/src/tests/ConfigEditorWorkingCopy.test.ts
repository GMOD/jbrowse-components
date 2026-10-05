import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import { getSnapshot, getType } from '@jbrowse/mobx-state-tree'

import { doBeforeEach, getPluginManager } from './util.tsx'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const TRACK_ID = 'volvox_filtered_vcf'

interface Editor {
  trackId?: string
  target?: AnyConfigurationModel
}

interface Session {
  views: {
    launchTrack: (id: string) => Promise<unknown>
    tracks: { configuration: AnyConfigurationModel }[]
  }[]
  tracks: AnyConfigurationModel[]
  trackConfigDeltas: Record<string, Record<string, unknown>>
  widgets: Map<string, Editor>
  editConfiguration: (conf: unknown) => void
  resetTrackConfiguration: (trackId: string) => void
  addSessionTrackConf: (conf: Record<string, unknown>) => AnyConfigurationModel
  deleteTrackConf: (conf: AnyConfigurationModel) => void
}

beforeEach(() => {
  doBeforeEach()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

async function setup({ shown }: { shown: boolean }) {
  const { rootModel } = await getPluginManager(undefined, false)
  const session = rootModel.session as unknown as Session
  const view = session.views[0]!
  if (shown) {
    await view.launchTrack(TRACK_ID)
  }
  jest.advanceTimersByTime(1000)
  const shownConfig = () =>
    view.tracks.find(t => t.configuration.trackId === TRACK_ID)!.configuration
  const editor = () => session.widgets.get('configEditor')!
  const selectorEntry = () => session.tracks.find(t => t.trackId === TRACK_ID)!
  return { rootModel, session, shownConfig, editor, selectorEntry }
}

function edit(
  conf: AnyConfigurationModel | undefined,
  slot: string,
  v: unknown,
) {
  conf!.setSlot(slot, v)
  jest.advanceTimersByTime(1000)
}

test('the selector opens the editor on the shown track’s working copy, so a quick edit made while it is open survives', async () => {
  const { session, shownConfig, editor, selectorEntry } = await setup({
    shown: true,
  })
  session.editConfiguration(selectorEntry())

  edit(shownConfig(), 'name', 'Quick')
  edit(editor().target, 'description', 'From editor')

  expect(readConfObject(shownConfig(), 'name')).toBe('Quick')
  expect(session.trackConfigDeltas[TRACK_ID]).toMatchObject({
    name: 'Quick',
    description: 'From editor',
  })
  expect(editor().target).toBe(shownConfig())
})

for (const path of ['selector', 'track menu'] as const) {
  test(`an edit in an editor opened from the ${path} does not bring back an undone value`, async () => {
    const { rootModel, session, shownConfig, editor, selectorEntry } =
      await setup({ shown: true })
    session.editConfiguration(
      path === 'selector' ? selectorEntry() : shownConfig(),
    )
    edit(editor().target, 'name', 'Undone')

    rootModel.history.undo()
    jest.advanceTimersByTime(2000)
    expect(rootModel.history.canRedo).toBe(true)

    edit(editor().target, 'description', 'Later')
    expect(session.trackConfigDeltas[TRACK_ID]).not.toHaveProperty('name')
    expect(readConfObject(shownConfig(), 'name')).toBe('volvox filtered vcf')
    expect(readConfObject(editor().target!, 'name')).toBe('volvox filtered vcf')
  })
}

test('an edit after a reset does not bring back the reset value on a track not shown', async () => {
  const { session, editor, selectorEntry } = await setup({ shown: false })
  session.editConfiguration(selectorEntry())
  edit(editor().target, 'name', 'Reset away')

  session.resetTrackConfiguration(TRACK_ID)
  edit(editor().target, 'description', 'Later')

  expect(session.trackConfigDeltas[TRACK_ID]).not.toHaveProperty('name')
})

test('the editor follows a track id re-added under another type', async () => {
  const { session, editor } = await setup({ shown: false })
  const id = 'readded'
  const conf = {
    trackId: id,
    name: 'Readded',
    assemblyNames: ['volvox'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  }
  const entry = session.addSessionTrackConf({ ...conf, type: 'FeatureTrack' })
  session.editConfiguration(session.tracks.find(t => t.trackId === id))
  expect(getType(editor().target!).name).toBe('FeatureTrackConfigurationSchema')

  session.deleteTrackConf(entry)
  expect(editor().target).toBeUndefined()

  session.addSessionTrackConf({ ...conf, type: 'VariantTrack' })
  expect(getType(editor().target!).name).toBe('VariantTrackConfigurationSchema')
})

test('a config the session does not resolve by id is edited as it stands', async () => {
  const { session, editor } = await setup({ shown: false })
  const inline = ConfigurationSchema(
    'InlineTrack',
    { name: { type: 'string', defaultValue: '' } },
    { explicitIdentifier: 'trackId' },
  ).create({ trackId: 'held_inline' })
  session.editConfiguration(inline)
  expect(editor().target).toBe(inline)
})

test('the editor’s track survives a session snapshot', async () => {
  const { session, editor, selectorEntry } = await setup({ shown: false })
  session.editConfiguration(selectorEntry())
  expect(getSnapshot(editor() as never)).toMatchObject({ trackId: TRACK_ID })
})
