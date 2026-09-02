import { doSubmit } from './doSubmit.tsx'

import type { LinearSyntenyViewModel } from '../../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { ImportFormSyntenyTrack } from '@jbrowse/synteny-core'

const track = (trackId: string, assemblyNames: string[]) =>
  ({
    trackId,
    type: 'SyntenyTrack',
    assemblyNames,
  }) as unknown as AnyConfigurationModel

interface Calls {
  views: { assembly: string }[]
  shown: [string, number][]
  toggled: [string, number][]
  added: { trackId: string }[]
  notified: string[]
  cleared: number
  autoScaled: number
}

function setup({
  selections,
  tracks = [],
  connectionTracks,
  canAddTracks = true,
}: {
  selections: (ImportFormSyntenyTrack | undefined)[]
  tracks?: AnyConfigurationModel[]
  connectionTracks?: AnyConfigurationModel[]
  canAddTracks?: boolean
}) {
  const calls: Calls = {
    views: [],
    shown: [],
    toggled: [],
    added: [],
    notified: [],
    cleared: 0,
    autoScaled: 0,
  }
  const session = {
    rpcManager: {},
    configuration: {},
    tracks,
    // no aliases in these fixtures: every name is already canonical
    assemblyManager: { getCanonicalAssemblyName: (name: string) => name },
    connectionInstances: connectionTracks
      ? [{ tracks: connectionTracks }]
      : undefined,
    notify: (msg: string) => calls.notified.push(msg),
    ...(canAddTracks
      ? {
          addSessionTrackConf: (conf: { trackId: string }) =>
            calls.added.push(conf),
        }
      : {}),
  }
  const model = {
    importFormSyntenyTrackSelections: selections,
    setViews: (views: { assembly: string }[]) => {
      calls.views = views
    },
    launchTrack: async (trackId: string, level: number) =>
      calls.shown.push([trackId, level]),
    toggleTrack: (trackId: string, level: number) =>
      calls.toggled.push([trackId, level]),
    autoScaleLevelHeights: () => calls.autoScaled++,
    clearImportFormSyntenyTracks: () => calls.cleared++,
  }
  return {
    calls,
    model: model as unknown as LinearSyntenyViewModel,
    session: session as unknown as AbstractSessionModel,
  }
}

test('one LinearGenomeView row per assembly, in order', () => {
  const { calls, model, session } = setup({ selections: [] })
  doSubmit({ selectedAssemblyNames: ['hg38', 'mm39', 'rn7'], model, session })
  expect(calls.views.map(v => v.assembly)).toEqual(['hg38', 'mm39', 'rn7'])
  expect(calls.autoScaled).toBe(1)
  expect(calls.cleared).toBe(1)
})

test('each pair shows its track on its own level', () => {
  // level i draws between rows i and i+1
  const { calls, model, session } = setup({
    selections: [],
    tracks: [
      track('hg38_mm39', ['hg38', 'mm39']),
      track('mm39_rn7', ['mm39', 'rn7']),
    ],
  })
  doSubmit({ selectedAssemblyNames: ['hg38', 'mm39', 'rn7'], model, session })
  expect(calls.shown).toEqual([
    ['hg38_mm39', 0],
    ['mm39_rn7', 1],
  ])
})

test('a pair with no track leaves its level empty without shifting others', () => {
  const { calls, model, session } = setup({
    selections: [],
    tracks: [track('mm39_rn7', ['mm39', 'rn7'])],
  })
  doSubmit({ selectedAssemblyNames: ['hg38', 'mm39', 'rn7'], model, session })
  expect(calls.shown).toEqual([['mm39_rn7', 1]])
})

test('an explicit none leaves its level empty even when a track fits', () => {
  const { calls, model, session } = setup({
    selections: [{ type: 'none' }],
    tracks: [track('hg38_mm39', ['hg38', 'mm39'])],
  })
  doSubmit({ selectedAssemblyNames: ['hg38', 'mm39'], model, session })
  expect(calls.shown).toEqual([])
})

test('a synteny track from a connection is found', () => {
  const { calls, model, session } = setup({
    selections: [],
    connectionTracks: [track('hub_track', ['hg38', 'mm39'])],
  })
  doSubmit({ selectedAssemblyNames: ['hg38', 'mm39'], model, session })
  expect(calls.shown).toEqual([['hub_track', 0]])
})

test('an upload is added to the session and shown on its level', () => {
  const conf = {
    trackId: 'opened',
    name: 'x',
    type: 'x',
    assemblyNames: ['mm39', 'rn7'],
  }
  const { calls, model, session } = setup({
    selections: [undefined, { type: 'userOpened', value: conf }],
  })
  doSubmit({ selectedAssemblyNames: ['hg38', 'mm39', 'rn7'], model, session })
  expect(calls.added).toEqual([conf])
  // shown, never toggled: the levels were just rebuilt empty, so a toggle could
  // only ever mean "show" — and would hide the track if that stopped holding
  expect(calls.shown).toEqual([['opened', 1]])
  expect(calls.toggled).toEqual([])
})

test('an upload stranded on a different pair is ignored, not misapplied', () => {
  // its baked assemblies no longer match the pair it sits on, e.g. a row was
  // removed or an assembly changed under it
  const conf = {
    trackId: 'opened',
    name: 'x',
    type: 'x',
    assemblyNames: ['mm39', 'rn7'],
  }
  const { calls, model, session } = setup({
    selections: [{ type: 'userOpened', value: conf }],
  })
  doSubmit({ selectedAssemblyNames: ['hg38', 'mm39'], model, session })
  expect(calls.added).toEqual([])
  expect(calls.toggled).toEqual([])
})

test('a self-alignment pair only matches a track naming the assembly twice', () => {
  const { calls, model, session } = setup({
    selections: [],
    tracks: [
      track('hg38_mm39', ['hg38', 'mm39']),
      track('hg38_self', ['hg38', 'hg38']),
    ],
  })
  doSubmit({ selectedAssemblyNames: ['hg38', 'hg38'], model, session })
  expect(calls.shown).toEqual([['hg38_self', 0]])
})

test('a session that cannot add tracks still shows a pre-configured track', () => {
  const { calls, model, session } = setup({
    selections: [],
    tracks: [track('hg38_mm39', ['hg38', 'mm39'])],
    canAddTracks: false,
  })
  doSubmit({ selectedAssemblyNames: ['hg38', 'mm39'], model, session })
  expect(calls.views).toHaveLength(2)
  expect(calls.shown).toEqual([['hg38_mm39', 0]])
  expect(calls.notified).toEqual([])
})

test('a session that cannot add tracks says so about an upload, and still builds the rows', () => {
  const { calls, model, session } = setup({
    selections: [
      {
        type: 'userOpened',
        value: {
          trackId: 'opened',
          name: 'opened',
          assemblyNames: ['hg38', 'mm39'],
          type: 'SyntenyTrack',
          adapter: { type: 'PAFAdapter' },
        },
      },
    ],
    canAddTracks: false,
  })
  doSubmit({ selectedAssemblyNames: ['hg38', 'mm39'], model, session })
  expect(calls.views).toHaveLength(2)
  expect(calls.shown).toEqual([])
  expect(calls.notified).toEqual(["Can't add tracks"])
})
