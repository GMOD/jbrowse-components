import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { seedSoloInTracks } from './CollapseIntronsDialog/util.ts'
import { createTestEnvironment } from './testEnv.ts'

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
