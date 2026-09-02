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
  cleared: number
  init?: unknown
}

function setup(
  selection: ImportFormSyntenyTrack | undefined,
  tracks: AnyConfigurationModel[] = [],
) {
  const calls: Calls = { shown: [], toggled: [], added: [], cleared: 0 }
  const model = {
    importFormSyntenyTrackSelections: [selection],
    setError() {},
    showTrack: (trackId: string) => calls.shown.push(trackId),
    toggleTrack: (trackId: string) => calls.toggled.push(trackId),
    setAssemblyNames: (x: string, y: string) => {
      calls.assemblyNames = [x, y]
    },
    setLaunch: (init: unknown) => {
      calls.init = init
    },
    clearImportFormSyntenyTracks: () => {
      calls.cleared++
    },
  } as unknown as DotplotViewModel

  const session = {
    rpcManager: {},
    configuration: {},
    tracks,
    // no aliases in these fixtures: every name is already canonical
    assemblyManager: { getCanonicalAssemblyName: (name: string) => name },
    addSessionTrackConf: (conf: { trackId: string }) => calls.added.push(conf),
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

  test('userOpened selection adds a track conf and shows it', () => {
    const conf = {
      trackId: 'opened',
      name: 'x',
      assemblyNames: ['hg38', 'mm10'],
      type: 'x',
    }
    const { calls, model, session } = setup({ type: 'userOpened', value: conf })
    doSubmit({ model, session, assemblyX: 'hg38', assemblyY: 'mm10' })
    expect(calls.added).toEqual([conf])
    // showTrack, not toggleTrack: addSessionTrackConf dedupes, so a re-submit would
    // otherwise hide the track it just added
    expect(calls.shown).toEqual(['opened'])
    expect(calls.toggled).toEqual([])
  })

  test('the pending selections are cleared once applied', () => {
    const { calls, model, session } = setup(
      { type: 'preConfigured', value: 'picked' },
      [track('picked')],
    )
    doSubmit({ model, session, assemblyX: 'hg38', assemblyY: 'mm10' })
    expect(calls.cleared).toBe(1)
  })

  test('userOpened whose assemblies no longer match is ignored', () => {
    // assemblies changed after the file was chosen; do not open the upload
    // against the wrong pair
    const conf = {
      trackId: 'opened',
      name: 'x',
      assemblyNames: ['hg38', 'mm10'],
      type: 'x',
    }
    const { calls, model, session } = setup({ type: 'userOpened', value: conf })
    doSubmit({ model, session, assemblyX: 'hg38', assemblyY: 'rn7' })
    expect(calls.added).toEqual([])
    expect(calls.toggled).toEqual([])
    expect(calls.assemblyNames).toEqual(['hg38', 'rn7'])
  })

  test('none selection touches no tracks but still sets assemblies', () => {
    const { calls, model, session } = setup({ type: 'none' }, [track('first')])
    doSubmit({ model, session, assemblyX: 'hg38', assemblyY: 'mm10' })
    expect(calls.shown).toEqual([])
    expect(calls.added).toEqual([])
    expect(calls.assemblyNames).toEqual(['hg38', 'mm10'])
  })

  function sessionNoAdd(tracks: unknown[], notified: string[]) {
    return {
      rpcManager: {},
      configuration: {},
      tracks,
      assemblyManager: { getCanonicalAssemblyName: (name: string) => name },
      notify: (message: string) => notified.push(message),
    } as unknown as AbstractSessionModel
  }

  test('a session that cannot add tracks still shows a pre-configured pick', () => {
    const { calls, model } = setup({ type: 'preConfigured', value: 'picked' }, [
      track('picked'),
    ])
    const notified: string[] = []
    doSubmit({
      model,
      session: sessionNoAdd([track('picked')], notified),
      assemblyX: 'hg38',
      assemblyY: 'mm10',
    })
    // showing needs nothing added, so there is nothing to refuse
    expect(calls.shown).toEqual(['picked'])
    expect(notified).toEqual([])
    expect(calls.assemblyNames).toEqual(['hg38', 'mm10'])
  })

  test('a session that cannot add tracks says so about an upload, and still sets assemblies', () => {
    const conf = {
      trackId: 'opened',
      name: 'x',
      assemblyNames: ['hg38', 'mm10'],
      type: 'x',
    }
    const { calls, model } = setup({ type: 'userOpened', value: conf })
    const notified: string[] = []
    doSubmit({
      model,
      session: sessionNoAdd([], notified),
      assemblyX: 'hg38',
      assemblyY: 'mm10',
    })
    expect(calls.shown).toEqual([])
    // opening the plot without the track the user built, and saying nothing,
    // is what the synteny form already refused to do
    expect(notified).toEqual(["Can't add tracks"])
    expect(calls.assemblyNames).toEqual(['hg38', 'mm10'])
  })

  test('an empty chromosome box leaves the axes unrestricted', () => {
    const { calls, model, session } = setup({ type: 'none' })
    doSubmit({ model, session, assemblyX: 'hg38', assemblyY: 'mm10' })
    // undefined, not an init holding two empty lists: `init` is persisted and
    // is what hasSomethingToShow consults
    expect(calls.init).toBeUndefined()
  })

  test('a glob per axis reaches the init as displayedRegionNames', () => {
    const { calls, model, session } = setup({ type: 'none' })
    doSubmit({
      model,
      session,
      assemblyX: 'hg002v1.2',
      assemblyY: 'hg002v1.2',
      regionsX: '*_MATERNAL',
      regionsY: '*_PATERNAL',
    })
    expect(calls.init).toEqual({
      views: [
        { assembly: 'hg002v1.2', displayedRegionNames: ['*_MATERNAL'] },
        { assembly: 'hg002v1.2', displayedRegionNames: ['*_PATERNAL'] },
      ],
    })
  })

  test('one box used still restricts only that axis', () => {
    const { calls, model, session } = setup({ type: 'none' })
    doSubmit({
      model,
      session,
      assemblyX: 'hg38',
      assemblyY: 'mm10',
      regionsX: 'chr1',
    })
    expect(calls.init).toEqual({
      views: [
        { assembly: 'hg38', displayedRegionNames: ['chr1'] },
        { assembly: 'mm10', displayedRegionNames: [] },
      ],
    })
  })

  test('a whitespace-padded list reaches the init trimmed', () => {
    const { calls, model, session } = setup({ type: 'none' })
    doSubmit({
      model,
      session,
      assemblyX: 'hg38',
      assemblyY: 'mm10',
      regionsX: 'chr1, chr2 ,',
    })
    expect(calls.init).toEqual({
      views: [
        { assembly: 'hg38', displayedRegionNames: ['chr1', 'chr2'] },
        { assembly: 'mm10', displayedRegionNames: [] },
      ],
    })
  })

  test('a box holding only whitespace is no restriction at all', () => {
    const { calls, model, session } = setup({ type: 'none' })
    doSubmit({
      model,
      session,
      assemblyX: 'hg38',
      assemblyY: 'mm10',
      regionsX: '  ',
      regionsY: ',',
    })
    expect(calls.init).toBeUndefined()
  })
})
