import { soloFeatureInView } from './util.ts'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

jest.mock('@jbrowse/core/configuration', () => ({
  readConfObject: (config: { trackId: string }) => config.trackId,
}))

// Minimal stand-in for the canvas display's solo set, exposing just the actions
// soloFeatureInView reaches through the SoloCapableDisplay structural guard.
function makeSoloDisplay(init?: { ids?: string[]; applied?: boolean }) {
  return {
    id: 'display1',
    soloFeatureIds: [...(init?.ids ?? [])],
    soloApplied: init?.applied ?? false,
    soloFeature(featureId: string) {
      this.soloFeatureIds = [featureId]
      this.soloApplied = true
    },
    toggleSoloFeature(featureId: string) {
      this.soloFeatureIds = this.soloFeatureIds.includes(featureId)
        ? this.soloFeatureIds.filter(id => id !== featureId)
        : [...this.soloFeatureIds, featureId]
      if (this.soloFeatureIds.length === 0) {
        this.soloApplied = false
      }
    },
    applySolo() {
      if (this.soloFeatureIds.length > 0) {
        this.soloApplied = true
      }
    },
    clearSolo() {
      this.soloFeatureIds = []
      this.soloApplied = false
    },
  }
}

function makeView(display: ReturnType<typeof makeSoloDisplay>) {
  return {
    tracks: [{ configuration: { trackId: 'track1' }, displays: [display] }],
  } as unknown as LinearGenomeViewModel
}

describe('soloFeatureInView', () => {
  it('isolates to the feature and restores an empty prior state on undo', () => {
    const display = makeSoloDisplay()
    const restore = soloFeatureInView(makeView(display), 'track1', 'geneA')

    expect(display.soloFeatureIds).toEqual(['geneA'])
    expect(display.soloApplied).toBe(true)

    restore()
    expect(display.soloFeatureIds).toEqual([])
    expect(display.soloApplied).toBe(false)
  })

  it('restores a prior applied solo set on undo', () => {
    const display = makeSoloDisplay({ ids: ['geneB', 'geneC'], applied: true })
    const restore = soloFeatureInView(makeView(display), 'track1', 'geneA')

    expect(display.soloFeatureIds).toEqual(['geneA'])

    restore()
    expect(display.soloFeatureIds).toEqual(['geneB', 'geneC'])
    expect(display.soloApplied).toBe(true)
  })

  it('restores a collected-but-unapplied prior set without re-applying', () => {
    const display = makeSoloDisplay({ ids: ['geneB'], applied: false })
    const restore = soloFeatureInView(makeView(display), 'track1', 'geneA')

    restore()
    expect(display.soloFeatureIds).toEqual(['geneB'])
    expect(display.soloApplied).toBe(false)
  })

  it('returns a no-op restore when no solo-capable display exists', () => {
    const view = {
      tracks: [{ configuration: { trackId: 'track1' }, displays: [] }],
    } as unknown as LinearGenomeViewModel
    expect(() => {
      soloFeatureInView(view, 'track1', 'geneA')()
    }).not.toThrow()
  })
})
