import { doSubmit } from './doSubmit.ts'

import type { DotplotViewModel } from '../../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { ImportFormSyntenyTrack } from '@jbrowse/synteny-core'

interface Calls {
  shown: string[]
  toggled: string[]
  added: { trackId: string }[]
  assemblyNames?: [string, string]
}

function setup(selections: ImportFormSyntenyTrack[] = []) {
  const calls: Calls = { shown: [], toggled: [], added: [] }
  const model = {
    importFormSyntenyTrackSelections: selections,
    setError() {},
    showTrack: (trackId: string) => calls.shown.push(trackId),
    toggleTrack: (trackId: string) => calls.toggled.push(trackId),
    setAssemblyNames: (x: string, y: string) => {
      calls.assemblyNames = [x, y]
    },
  } as unknown as DotplotViewModel

  const session = {
    rpcManager: {},
    configuration: {},
    addTrackConf: (conf: { trackId: string }) => calls.added.push(conf),
  } as unknown as AbstractSessionModel

  const track = (trackId: string) =>
    ({ trackId }) as unknown as AnyConfigurationModel

  return { calls, model, session, track }
}

test('tracklist with an explicit pick shows that track', () => {
  const { calls, model, session, track } = setup()
  doSubmit({
    model,
    session,
    assemblyX: 'hg38',
    assemblyY: 'mm10',
    choice: 'tracklist',
    preConfiguredTrackId: 'picked',
    syntenyTracks: [track('first'), track('picked')],
  })
  expect(calls.shown).toEqual(['picked'])
  expect(calls.assemblyNames).toEqual(['hg38', 'mm10'])
})

test('tracklist with no explicit pick falls back to the first match', () => {
  const { calls, model, session, track } = setup()
  doSubmit({
    model,
    session,
    assemblyX: 'hg38',
    assemblyY: 'mm10',
    choice: 'tracklist',
    preConfiguredTrackId: '',
    syntenyTracks: [track('first'), track('second')],
  })
  expect(calls.shown).toEqual(['first'])
})

test('tracklist with no matching tracks shows nothing but still sets assemblies', () => {
  const { calls, model, session } = setup()
  doSubmit({
    model,
    session,
    assemblyX: 'hg38',
    assemblyY: 'mm10',
    choice: 'tracklist',
    preConfiguredTrackId: '',
    syntenyTracks: [],
  })
  expect(calls.shown).toEqual([])
  expect(calls.assemblyNames).toEqual(['hg38', 'mm10'])
})

test('non-tracklist choice adds a userOpened track from the model', () => {
  const conf = { trackId: 'opened', name: 'x', assemblyNames: [], type: 'x' }
  const { calls, model, session } = setup([
    { type: 'userOpened', value: conf },
  ])
  doSubmit({
    model,
    session,
    assemblyX: 'hg38',
    assemblyY: 'mm10',
    choice: 'custom',
    preConfiguredTrackId: '',
    syntenyTracks: [],
  })
  expect(calls.added).toEqual([conf])
  expect(calls.toggled).toEqual(['opened'])
})

test('non-tracklist choice shows a preConfigured selection from the model', () => {
  const { calls, model, session } = setup([
    { type: 'preConfigured', value: 'ext' },
  ])
  doSubmit({
    model,
    session,
    assemblyX: 'hg38',
    assemblyY: 'mm10',
    choice: 'extensionThing',
    preConfiguredTrackId: '',
    syntenyTracks: [],
  })
  expect(calls.shown).toEqual(['ext'])
})

test('none choice with an empty model touches no tracks', () => {
  const { calls, model, session } = setup([{ type: 'none' }])
  doSubmit({
    model,
    session,
    assemblyX: 'hg38',
    assemblyY: 'mm10',
    choice: 'none',
    preConfiguredTrackId: '',
    syntenyTracks: [],
  })
  expect(calls.shown).toEqual([])
  expect(calls.added).toEqual([])
  expect(calls.assemblyNames).toEqual(['hg38', 'mm10'])
})

test('session that cannot add tracks still sets assemblies', () => {
  const { calls, model, track } = setup()
  const sessionNoAdd = {
    rpcManager: {},
    configuration: {},
  } as unknown as AbstractSessionModel
  doSubmit({
    model,
    session: sessionNoAdd,
    assemblyX: 'hg38',
    assemblyY: 'mm10',
    choice: 'tracklist',
    preConfiguredTrackId: 'picked',
    syntenyTracks: [track('picked')],
  })
  expect(calls.shown).toEqual([])
  expect(calls.assemblyNames).toEqual(['hg38', 'mm10'])
})
