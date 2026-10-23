import { readConfObject } from '@jbrowse/core/configuration'

import createViewState from './createViewState.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfigurationModel,
  TrackConfigEntry,
} from '@jbrowse/core/configuration'

jest.mock('./makeWorkerInstance', () => () => {})

const assemblies = ['volvox', 'other'].map(name => ({
  name,
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: `${name}_refseq`,
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        { refName: 'ctgA', uniqueId: name, start: 0, end: 4, seq: 'acgt' },
      ],
    },
  },
}))

interface Session {
  getTrackById: (trackId: string) => TrackConfigEntry | undefined
  getTrackConfigChanges: (
    trackId: string,
  ) => { path: string[]; from: unknown; to: unknown }[]
}

const Y = ['encoding', 'y'] as const
const COVERAGE_Y = ['coverage', ...Y] as const

const wiggle = {
  type: 'QuantitativeTrack',
  adapter: { type: 'BigWigAdapter', uri: 'x.bw' },
  display: 'LinearWiggleDisplay',
  y: Y,
}
const mark = {
  type: 'FeatureTrack',
  adapter: { type: 'BedTabixAdapter', uri: 'x.bed.gz' },
  display: 'LinearMarkDisplay',
  y: Y,
}
const alignments = {
  type: 'AlignmentsTrack',
  adapter: { type: 'BamAdapter', uri: 'x.bam' },
  display: 'LinearAlignmentsDisplay',
  y: COVERAGE_Y,
}
const maf = {
  type: 'MafTrack',
  adapter: { type: 'MafTabixAdapter', uri: 'x.bed.gz', samples: ['volvox'] },
  display: 'LinearMafDisplay',
  y: COVERAGE_Y,
}
const lgvSynteny = {
  type: 'SyntenyTrack',
  adapter: {
    type: 'PAFAdapter',
    uri: 'x.paf',
    queryAssembly: 'other',
    targetAssembly: 'volvox',
  },
  display: 'LGVSyntenyDisplay',
  y: COVERAGE_Y,
}

type Kind = typeof wiggle | typeof mark | typeof alignments

function nestedAt(path: readonly string[], value: unknown) {
  return path.reduceRight<unknown>((inner, key) => ({ [key]: inner }), value)
}

function load(
  kind: Kind,
  base: Record<string, unknown>,
  delta: Record<string, unknown>,
) {
  const displayId = `t-${kind.display}`
  const state = createViewState({
    config: {
      assemblies,
      tracks: [
        {
          type: kind.type,
          trackId: 't',
          name: 't',
          assemblyNames: kind === lgvSynteny ? ['volvox', 'other'] : ['volvox'],
          adapter: kind.adapter,
          displays: [{ type: kind.display, displayId, ...base }],
        },
      ],
    },
    session: {
      name: 'old',
      trackConfigDeltas: {
        t: { trackId: 't', displays: [{ displayId, ...delta }] },
      },
    },
  })
  const { pluginManager } = state as unknown as { pluginManager: PluginManager }
  const session = state.session as unknown as Session
  const track = pluginManager
    .pluggableConfigSchemaType('track')
    .create(session.getTrackById('t'), { pluginManager }) as unknown as {
    displays: AnyConfigurationModel[]
  }
  const display = track.displays.find(d => d.displayId === displayId)!
  return {
    session,
    read: (...path: string[]) => readConfObject(display, [...kind.y, ...path]),
  }
}

const baseScale = (kind: Kind) =>
  nestedAt(kind.y, {
    scale: { type: 'log', domainMax: 9 },
    axis: { title: 'AF', grid: true },
    rules: [3],
  }) as Record<string, unknown>

describe.each([wiggle, mark, alignments, maf, lgvSynteny])(
  'an old $display delta over a base written $y',
  kind => {
    test('scales.y wins member by member', () => {
      const { read } = load(kind, baseScale(kind), {
        scales: { y: { domainMax: 50, title: 'depth' } },
      })
      expect(read('scale', 'domainMax')).toBe(50)
      expect(read('axis', 'title')).toBe('depth')
      expect(read('scale', 'type')).toBe('log')
      expect(read('axis', 'grid')).toBe(true)
    })

    test('a null under scales.y resets that member', () => {
      const { read } = load(kind, baseScale(kind), {
        scales: { y: { domainMax: null } },
      })
      expect(read('scale', 'domainMax')).toBeUndefined()
      expect(read('scale', 'type')).toBe('log')
    })

    test.each([{ scales: null }, { scales: { y: null } }])(
      '%j resets every y member',
      delta => {
        const { read } = load(kind, baseScale(kind), delta)
        expect(read('scale', 'domainMax')).toBeUndefined()
        expect(read('scale', 'type')).toBe('linear')
        expect(read('axis', 'title')).toBeUndefined()
        expect(read('axis', 'grid')).toBe(false)
      },
    )

    test('the changes list names the member at its current path', () => {
      const { session } = load(kind, baseScale(kind), {
        scales: { y: { domainMax: 50 } },
      })
      expect(session.getTrackConfigChanges('t')).toEqual([
        {
          path: ['displays', kind.display, ...kind.y, 'scale', 'domainMax'],
          from: 9,
          to: 50,
        },
      ])
    })
  },
)

describe('an old wiggle delta in the slots before scales.y', () => {
  const base = {
    encoding: {
      y: {
        field: 'maxScore',
        scale: { type: 'log', domainMax: 9 },
        axis: { grid: true },
      },
    },
  }

  test('y names the field', () => {
    const { read } = load(wiggle, base, { y: 'minScore' })
    expect(read('field')).toBe('minScore')
    expect(read('scale', 'type')).toBe('log')
  })

  test('scaleType and displayCrossHatches win', () => {
    const { read } = load(wiggle, base, {
      scaleType: 'linear',
      displayCrossHatches: false,
    })
    expect(read('scale', 'type')).toBe('linear')
    expect(read('axis', 'grid')).toBe(false)
    expect(read('field')).toBe('maxScore')
  })

  test.each([
    [{ scaleType: null }, ['scale', 'type'], 'linear'],
    [{ maxScore: null }, ['scale', 'domainMax'], undefined],
    [{ displayCrossHatches: null }, ['axis', 'grid'], false],
    [{ y: null }, ['field'], 'score'],
  ])('%j resets what it lifts onto', (delta, path, expected) => {
    const { read } = load(wiggle, base, delta)
    expect(read(...path)).toBe(expected)
  })
})
