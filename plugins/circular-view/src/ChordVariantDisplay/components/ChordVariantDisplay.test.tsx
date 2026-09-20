import PluginManager from '@jbrowse/core/PluginManager'
import { SimpleFeature } from '@jbrowse/core/util'
import { render } from '@testing-library/react'

import configSchemaF from '../models/configSchema.ts'
import ChordVariantDisplay from './ChordVariantDisplay.tsx'

import type { ChordDisplayModel } from '../../chords/types.ts'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'

const configuration = configSchemaF(new PluginManager()).create({
  type: 'ChordVariantDisplay',
  displayId: 'sv-ChordVariantDisplay',
})

function chordModel(
  phase: DisplayStatusPhase,
  overrides: Partial<ChordDisplayModel> = {},
): ChordDisplayModel {
  return {
    error: undefined,
    displayError: undefined,
    view: { offsetRadians: 0 },
    ready: phase === 'ready',
    displayPhase: phase,
    svgReady: phase !== 'loading',
    drawnFeatures: [],
    sliceFor: () => undefined,
    selectedFeatureId: undefined,
    configuration,
    radiusPx: 100,
    bezierRadius: 50,
    onChordClick: () => {},
    openErrorDialog: () => {},
    reload: () => {},
    ...overrides,
  }
}

function attrs(model: ChordDisplayModel) {
  const { container } = render(
    <svg>
      <ChordVariantDisplay display={model} />
    </svg>,
  )
  const g = container.querySelector<SVGElement>('[data-display-phase]')
  return {
    testid: g?.dataset.testid,
    id: g?.dataset.displayId,
    drawn: g?.dataset.displayDrawn,
    phase: g?.dataset.displayPhase,
  }
}

// `PENDING_DISPLAYS` (@jbrowse/browser-test-utils) is
// `[data-display-drawn="false"]`, so a display publishing only a phase is
// counted as zero pending displays rather than as one — a circular view with an
// unpainted chord track read as finished, and `displayPainted` had nothing to
// target.
test('an unpainted chord track is pending, not absent', () => {
  expect(attrs(chordModel('loading'))).toEqual({
    testid: 'circular-chord-display',
    id: 'sv-ChordVariantDisplay',
    drawn: 'false',
    phase: 'loading',
  })
})

test('a painted chord track publishes drawn beside its phase', () => {
  expect(attrs(chordModel('ready'))).toEqual({
    testid: 'circular-chord-display',
    id: 'sv-ChordVariantDisplay',
    drawn: 'true',
    phase: 'ready',
  })
})

// The states that never paint are terminal, so `painted` answers finished
// rather than pending — the rule `foundationPaintInert` states for the canvas
// families, which a capture would otherwise wait out in silence.
test('the error terminal is finished rather than pending', () => {
  expect(
    attrs(
      chordModel('error', { displayError: new Error('adapter fell over') }),
    ),
  ).toEqual({
    testid: 'circular-chord-display',
    id: 'sv-ChordVariantDisplay',
    drawn: 'true',
    phase: 'error',
  })
})

const slice = {
  startRadians: 0,
  endRadians: Math.PI,
  bpPerRadian: 1000,
  region: { elided: false as const, start: 0 },
} as unknown as ReturnType<ChordDisplayModel['sliceFor']>

function bnd(uniqueId: string, start: number, mate: number) {
  return new SimpleFeature({
    uniqueId,
    refName: 'chr1',
    start,
    end: start + 1,
    ALT: [`C]chr1:${mate}]`],
  })
}

test('chords outside the highlighted set dim, and with no set none do', () => {
  const features = [bnd('a', 100, 900), bnd('b', 200, 800)]
  const opacities = (overrides: Partial<ChordDisplayModel>) => {
    const { container } = render(
      <svg>
        <ChordVariantDisplay
          display={chordModel('ready', {
            drawnFeatures: features,
            sliceFor: () => slice,
            ...overrides,
          })}
        />
      </svg>,
    )
    return [...container.querySelectorAll('path')].map(p =>
      p.getAttribute('opacity'),
    )
  }
  expect(opacities({})).toEqual([null, null])
  expect(opacities({ highlightedFeatureIdSet: new Set(['b']) })).toEqual([
    '0.15',
    null,
  ])
})
