import { doSubmit } from './doSubmit.ts'

import type { DotplotViewModel } from '../../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { ImportFormSyntenyTrack } from '@jbrowse/synteny-core'

const track = (trackId: string) =>
  ({
    trackId,
    type: 'SyntenyTrack',
    assemblyNames: ['hg38', 'mm10'],
  }) as unknown as AnyConfigurationModel

interface Calls {
  shown: string[]
  toggled: string[]
  added: { trackId: string }[]
  assemblyNames?: [string, string]
}

function setup(
  selection: ImportFormSyntenyTrack | undefined,
  tracks: AnyConfigurationModel[] = [],
) {
  const calls: Calls = { shown: [], toggled: [], added: [] }
  const model = {
    importFormSyntenyTrackSelections: [selection],
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
    tracks,
    addTrackConf: (conf: { trackId: string }) => calls.added.push(conf),
  } as unknown as AbstractSessionModel

  return { calls, model, session }
}

describe('doSubmit', () => {
  test('preConfigured selection shows the track and sets assemblies', () => {
    const { calls, model, session } = setup(
      { type: 'preConfigured', value: 'picked' },
      [track('first'), track('picked')],
    )
    doSubmit({ model, session, assemblyX: 'hg38', assemblyY: 'mm10' })
    expect(calls.shown).toEqual(['picked'])
    expect(calls.assemblyNames).toEqual(['hg38', 'mm10'])
  })

  test('untouched tracklist shows the first available track', () => {
    const { calls, model, session } = setup(
      { type: 'preConfigured', value: '' },
      [track('first'), track('second')],
    )
    doSubmit({ model, session, assemblyX: 'hg38', assemblyY: 'mm10' })
    expect(calls.shown).toEqual(['first'])
    expect(calls.assemblyNames).toEqual(['hg38', 'mm10'])
  })

  test('userOpened selection adds a track conf and toggles it on', () => {
    const conf = { trackId: 'opened', name: 'x', assemblyNames: [], type: 'x' }
    const { calls, model, session } = setup({ type: 'userOpened', value: conf })
    doSubmit({ model, session, assemblyX: 'hg38', assemblyY: 'mm10' })
    expect(calls.added).toEqual([conf])
    expect(calls.toggled).toEqual(['opened'])
  })

  test('none selection touches no tracks but still sets assemblies', () => {
    const { calls, model, session } = setup({ type: 'none' }, [track('first')])
    doSubmit({ model, session, assemblyX: 'hg38', assemblyY: 'mm10' })
    expect(calls.shown).toEqual([])
    expect(calls.added).toEqual([])
    expect(calls.assemblyNames).toEqual(['hg38', 'mm10'])
  })

  test('session that cannot add tracks still sets assemblies', () => {
    const { calls, model } = setup({ type: 'preConfigured', value: 'picked' }, [
      track('picked'),
    ])
    const sessionNoAdd = {
      rpcManager: {},
      configuration: {},
      tracks: [track('picked')],
    } as unknown as AbstractSessionModel
    doSubmit({
      model,
      session: sessionNoAdd,
      assemblyX: 'hg38',
      assemblyY: 'mm10',
    })
    expect(calls.shown).toEqual([])
    expect(calls.assemblyNames).toEqual(['hg38', 'mm10'])
  })
})
