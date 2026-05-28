import { doSubmit, resolveImportFormSelection } from './doSubmit.ts'

import type { DotplotViewModel } from '../../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { ImportFormSyntenyTrack } from '@jbrowse/synteny-core'

const track = (trackId: string) =>
  ({ trackId }) as unknown as AnyConfigurationModel

describe('resolveImportFormSelection', () => {
  test('tracklist with an explicit pick', () => {
    expect(
      resolveImportFormSelection({
        choice: 'tracklist',
        preConfiguredTrackId: 'picked',
        syntenyTracks: [track('first'), track('picked')],
        modelSelection: undefined,
      }),
    ).toEqual({ type: 'preConfigured', value: 'picked' })
  })

  test('tracklist with no pick falls back to the first match', () => {
    expect(
      resolveImportFormSelection({
        choice: 'tracklist',
        preConfiguredTrackId: '',
        syntenyTracks: [track('first'), track('second')],
        modelSelection: undefined,
      }),
    ).toEqual({ type: 'preConfigured', value: 'first' })
  })

  test('tracklist with no matching tracks is none', () => {
    expect(
      resolveImportFormSelection({
        choice: 'tracklist',
        preConfiguredTrackId: '',
        syntenyTracks: [],
        modelSelection: undefined,
      }),
    ).toEqual({ type: 'none' })
  })

  test('tracklist ignores any stale model selection', () => {
    expect(
      resolveImportFormSelection({
        choice: 'tracklist',
        preConfiguredTrackId: '',
        syntenyTracks: [track('first')],
        modelSelection: { type: 'userOpened', value: { trackId: 'stale' } },
      }),
    ).toEqual({ type: 'preConfigured', value: 'first' })
  })

  test('non-tracklist choice reads the model selection', () => {
    const sel: ImportFormSyntenyTrack = {
      type: 'userOpened',
      value: { trackId: 'opened' },
    }
    expect(
      resolveImportFormSelection({
        choice: 'custom',
        preConfiguredTrackId: '',
        syntenyTracks: [],
        modelSelection: sel,
      }),
    ).toEqual(sel)
  })

  test('non-tracklist choice with no model selection is none', () => {
    expect(
      resolveImportFormSelection({
        choice: 'custom',
        preConfiguredTrackId: '',
        syntenyTracks: [],
        modelSelection: undefined,
      }),
    ).toEqual({ type: 'none' })
  })
})

interface Calls {
  shown: string[]
  toggled: string[]
  added: { trackId: string }[]
  assemblyNames?: [string, string]
}

function setup() {
  const calls: Calls = { shown: [], toggled: [], added: [] }
  const model = {
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

  return { calls, model, session }
}

describe('doSubmit', () => {
  test('preConfigured selection shows the track and sets assemblies', () => {
    const { calls, model, session } = setup()
    doSubmit({
      model,
      session,
      assemblyX: 'hg38',
      assemblyY: 'mm10',
      selection: { type: 'preConfigured', value: 'picked' },
    })
    expect(calls.shown).toEqual(['picked'])
    expect(calls.assemblyNames).toEqual(['hg38', 'mm10'])
  })

  test('userOpened selection adds a track conf and toggles it on', () => {
    const { calls, model, session } = setup()
    const conf = { trackId: 'opened', name: 'x', assemblyNames: [], type: 'x' }
    doSubmit({
      model,
      session,
      assemblyX: 'hg38',
      assemblyY: 'mm10',
      selection: { type: 'userOpened', value: conf },
    })
    expect(calls.added).toEqual([conf])
    expect(calls.toggled).toEqual(['opened'])
  })

  test('none selection touches no tracks but still sets assemblies', () => {
    const { calls, model, session } = setup()
    doSubmit({
      model,
      session,
      assemblyX: 'hg38',
      assemblyY: 'mm10',
      selection: { type: 'none' },
    })
    expect(calls.shown).toEqual([])
    expect(calls.added).toEqual([])
    expect(calls.assemblyNames).toEqual(['hg38', 'mm10'])
  })

  test('session that cannot add tracks still sets assemblies', () => {
    const { calls, model } = setup()
    const sessionNoAdd = {
      rpcManager: {},
      configuration: {},
    } as unknown as AbstractSessionModel
    doSubmit({
      model,
      session: sessionNoAdd,
      assemblyX: 'hg38',
      assemblyY: 'mm10',
      selection: { type: 'preConfigured', value: 'picked' },
    })
    expect(calls.shown).toEqual([])
    expect(calls.assemblyNames).toEqual(['hg38', 'mm10'])
  })
})
