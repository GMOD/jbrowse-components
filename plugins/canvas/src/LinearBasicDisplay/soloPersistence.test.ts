import { getSnapshot } from '@jbrowse/mobx-state-tree'

import {
  buildCollapsedViewSnapshot,
  seedSoloInTracks,
} from './CollapseIntronsDialog/util.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'

function feat(fields: Record<string, unknown>): Feature {
  return { get: (k: string) => fields[k] } as unknown as Feature
}

// A minus-strand-agnostic two-exon gene with a wide intron, so collapsing
// yields two padded regions.
const transcripts = [
  feat({
    refName: 'ctgA',
    name: 'myGene',
    subfeatures: [
      feat({ type: 'exon', start: 0, end: 100 }),
      feat({ type: 'exon', start: 5000, end: 5100 }),
    ],
  }),
]

const assembly = {
  name: 'volvox',
  getCanonicalRefName2: (r: string) => r,
  regions: [{ refName: 'ctgA', start: 0, end: 50_000 }],
} as unknown as Assembly

// These tests pin the behavior that makes solo/hidden a declarative prop:
//   - a display created with solo/hidden in its snapshot hydrates already
//     isolated, and the isolation reaches the worker (rpcProps)
//   - stripDefault keeps an at-default display's snapshot clean, but preserves
//     seeded (non-default) values so they survive a session save/reload
//   - seedSoloInTracks injects onto the solo-capable display only
describe('solo/hidden declarative persistence', () => {
  it('a snapshot-seeded display hydrates already isolated', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({
      soloFeatureIds: ['gene1'],
      soloApplied: true,
    })

    expect(display.soloApplied).toBe(true)
    expect([...display.soloFeatureIdSet]).toEqual(['gene1'])
    // The value the worker uses to drop non-members — proves the seed actually
    // isolates rather than just sitting in state.
    expect(display.rpcProps().soloFeatureIds).toEqual(['gene1'])
  })

  it('collected-but-unapplied solo does not isolate (soloApplied gate)', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({ soloFeatureIds: ['gene1'] })

    expect(display.soloApplied).toBe(false)
    expect(display.rpcProps().soloFeatureIds).toBeUndefined()
  })

  it('a snapshot-seeded hidden set reaches the worker immediately', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({ hiddenFeatureIds: ['gene2'] })

    expect([...display.hiddenFeatureIdSet]).toEqual(['gene2'])
    expect(display.rpcProps().hiddenFeatureIds).toEqual(['gene2'])
  })

  it('stripDefault omits the feature-id props from an at-default snapshot', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const snap = getSnapshot(display)

    expect(snap.soloFeatureIds).toBeUndefined()
    expect(snap.soloApplied).toBeUndefined()
    expect(snap.hiddenFeatureIds).toBeUndefined()
    expect(snap.pinnedFeatureIds).toBeUndefined()
  })

  it('stripDefault preserves seeded values through a snapshot round-trip', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({
      soloFeatureIds: ['gene1'],
      soloApplied: true,
      hiddenFeatureIds: ['gene2'],
    })
    const snap = getSnapshot(display)

    expect(snap.soloFeatureIds).toEqual(['gene1'])
    expect(snap.soloApplied).toBe(true)
    expect(snap.hiddenFeatureIds).toEqual(['gene2'])
  })

  it('runtime actions still drive the persistent props', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    display.soloFeature('gene3')
    expect(display.soloApplied).toBe(true)
    expect(display.rpcProps().soloFeatureIds).toEqual(['gene3'])

    display.clearSolo()
    expect(display.soloApplied).toBe(false)
    expect(display.rpcProps().soloFeatureIds).toBeUndefined()
  })
})

describe('seedSoloInTracks', () => {
  it('injects solo onto the solo-capable display of the matching track', () => {
    const { createDisplay } = createTestEnvironment()
    const { view } = createDisplay()
    const snap = getSnapshot(view) as unknown as {
      tracks: { id: string; displays: { id: string }[] }[]
    }

    const seeded = seedSoloInTracks(
      snap.tracks,
      view,
      'test_track',
      'gene1',
    )

    const display = seeded[0]!.displays[0]! as Record<string, unknown>
    expect(display.soloFeatureIds).toEqual(['gene1'])
    expect(display.soloApplied).toBe(true)
  })

  it('returns tracks unchanged when the trackId does not match', () => {
    const { createDisplay } = createTestEnvironment()
    const { view } = createDisplay()
    const snap = getSnapshot(view) as unknown as {
      tracks: { id: string; displays: { id: string }[] }[]
    }

    const seeded = seedSoloInTracks(
      snap.tracks,
      view,
      'no_such_track',
      'gene1',
    )

    const display = seeded[0]!.displays[0]! as Record<string, unknown>
    expect(display.soloFeatureIds).toBeUndefined()
    expect(display.soloApplied).toBeUndefined()
  })
})

// buildCollapsedViewSnapshot is the pure half of collapseIntrons: it turns a
// live view + transcripts into a complete, self-contained view snapshot. These
// prove the whole collapsed view — regions, zoom, and solo focus — is data,
// with no post-init mutation (collapseIntrons only hands the result to addView).
describe('buildCollapsedViewSnapshot', () => {
  function args(soloFeatureId?: string) {
    const { view } = createTestEnvironment().createDisplay()
    return {
      view,
      transcripts,
      assembly,
      padding: 20,
      flip: false,
      trackId: 'test_track',
      soloFeatureId,
    }
  }

  it('builds merged regions and precomputed zoom/offset', () => {
    const snap = buildCollapsedViewSnapshot(args())

    // Two exons with a wide intron collapse to two padded regions.
    expect(snap.displayedRegions).toHaveLength(2)
    expect(snap.displayedRegions[0]).toMatchObject({ refName: 'ctgA' })
    expect(snap.bpPerPx).toBeGreaterThan(0)
    expect(snap.displayName).toContain('(introns collapsed)')
  })

  it('strips track/display ids so the snapshot re-adds without collision', () => {
    const snap = buildCollapsedViewSnapshot(args()) as unknown as {
      tracks: { id?: string; displays: { id?: string }[] }[]
    }

    expect(snap.tracks[0]!.id).toBeUndefined()
    expect(snap.tracks[0]!.displays[0]!.id).toBeUndefined()
  })

  it('seeds the display solo when a feature is requested', () => {
    const snap = buildCollapsedViewSnapshot(args('geneX')) as unknown as {
      tracks: { displays: Record<string, unknown>[] }[]
    }

    expect(snap.tracks[0]!.displays[0]!.soloFeatureIds).toEqual(['geneX'])
    expect(snap.tracks[0]!.displays[0]!.soloApplied).toBe(true)
  })

  it('leaves the display un-soloed when no feature is requested', () => {
    const snap = buildCollapsedViewSnapshot(args()) as unknown as {
      tracks: { displays: Record<string, unknown>[] }[]
    }

    expect(snap.tracks[0]!.displays[0]!.soloFeatureIds).toBeUndefined()
    expect(snap.tracks[0]!.displays[0]!.soloApplied).toBeUndefined()
  })
})
