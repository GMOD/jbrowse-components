import PluginManager from '@jbrowse/core/PluginManager'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { SimpleFeature } from '@jbrowse/core/util'
import { render } from '@testing-library/react'

import ChordVariantDisplay from '../../chords/ShapeDisplay.tsx'
import ShapePaths from '../../chords/ShapePaths.tsx'
import configSchemaF from '../models/configSchema.ts'

import type { ChordShape } from '../../chords/shapes.ts'
import type { ShapeDisplayModel } from '../../chords/types.ts'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'

const configuration = configSchemaF(new PluginManager()).create({
  type: 'ChordVariantDisplay',
  displayId: 'sv-ChordVariantDisplay',
})

function chordModel(
  phase: DisplayStatusPhase,
  overrides: Partial<ShapeDisplayModel> = {},
): ShapeDisplayModel {
  return {
    id: 'sv',
    error: undefined,
    displayError: undefined,
    view: {
      offsetRadians: 0,
      chordDisplays: [],
      chordPass: { drew: () => true, renderError: undefined },
    },
    ready: phase === 'ready',
    displayPhase: phase,
    svgReady: phase !== 'loading',
    drawnCount: overrides.shapes?.length ?? 0,
    shapes: [],
    shapesTestId: 'structuralVariantChordRenderer',
    shapeFor: id =>
      (overrides.shapes ?? []).find(shape => shape.feature.id() === id),
    chordCell: undefined,
    hitAt: () => undefined,
    shapeAlpha: 1,
    selectedFeatureId: undefined,
    hoveredFeatureId: undefined,
    configuration,
    radiusPx: 100,
    bezierRadius: 50,
    clickFeature: () => {},
    shapeLabel: () => 'a chord',
    openErrorDialog: () => {},
    reload: () => {},
    ...overrides,
  }
}

function attrs(model: ShapeDisplayModel) {
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

test('a second failing track adds a line under the first, not another disc', () => {
  const chordDisplays = [
    { id: 'a', displayPhase: 'error' as const },
    { id: 'b', displayPhase: 'ready' as const },
    { id: 'c', displayPhase: 'error' as const },
  ]
  const failing = (id: string) =>
    chordModel('error', {
      id,
      displayError: new Error(`${id} fell over`),
      view: {
        offsetRadians: 0,
        chordDisplays,
        chordPass: { drew: () => true, renderError: undefined },
      },
    })
  const { container } = render(
    <svg>
      <ChordVariantDisplay display={failing('a')} />
      <ChordVariantDisplay display={failing('c')} />
    </svg>,
  )
  const [first, second] = container.querySelectorAll('[data-display-phase]')
  expect(first!.querySelector('g[opacity]')?.getAttribute('opacity')).toBe(
    '0.35',
  )
  expect(second!.querySelector('circle')).toBeNull()
  expect(first!.querySelector('text')?.getAttribute('y')).toBe('0em')
  expect(second!.querySelector('text')?.getAttribute('y')).toBe('3em')
})

function bnd(uniqueId: string, start: number, mate: number) {
  return new SimpleFeature({
    uniqueId,
    refName: 'chr1',
    start,
    end: start + 1,
    ALT: [`C]chr1:${mate}]`],
  })
}

function shapesOf(...features: SimpleFeature[]): ChordShape[] {
  return features.map(feature => ({
    kind: 'chord',
    feature,
    ends: {
      startRadians: feature.get('start') / 1000,
      endRadians: Math.PI,
    },
    stroke: 'rgba(255,133,0,0.32)',
  }))
}

test('on screen the renderer group counts every chord and draws the hovered one', () => {
  const { container } = render(
    <svg>
      <ChordVariantDisplay
        display={chordModel('ready', {
          shapes: shapesOf(bnd('a', 100, 900), bnd('b', 200, 800)),
          hoveredFeatureId: 'b',
        })}
      />
    </svg>,
  )
  const g = container.querySelector<SVGElement>(
    '[data-testid="structuralVariantChordRenderer"]',
  )!
  expect(g.dataset.chordCount).toBe('2')
  const paths = [...container.querySelectorAll('path')]
  expect(paths.map(p => p.dataset.testid)).toEqual(['chord-b'])
  expect(paths[0]!.getAttribute('stroke-width')).toBe('3')
})

test('the export dims the chords in the dimmed set, and with no set none', () => {
  const opacities = (overrides: Partial<ShapeDisplayModel>) => {
    const { container } = render(
      <svg>
        <ShapePaths
          display={chordModel('ready', {
            shapes: shapesOf(bnd('a', 100, 900), bnd('b', 200, 800)),
            ...overrides,
          })}
          testid="structuralVariantChordRenderer"
          only="all"
        />
      </svg>,
    )
    return [...container.querySelectorAll('path')].map(p =>
      p.getAttribute('opacity'),
    )
  }
  expect(opacities({})).toEqual([null, null])
  expect(opacities({ dimmedFeatureIds: new Set(['a']) })).toEqual([
    '0.15',
    null,
  ])
})

test("the export draws each chord at the display's opacity, over its color's alpha and the dimming", () => {
  const { container } = render(
    <svg>
      <ShapePaths
        display={chordModel('ready', {
          shapes: shapesOf(bnd('a', 100, 900), bnd('b', 200, 800)),
          shapeAlpha: 0.45,
          dimmedFeatureIds: new Set(['a']),
        })}
        testid="structuralVariantChordRenderer"
        only="all"
      />
    </svg>,
  )
  const paths = [...container.querySelectorAll('path')]
  expect(paths.map(p => Number(p.getAttribute('opacity')))).toEqual([
    expect.closeTo(0.45 * 0.15),
    0.45,
  ])
  expect(paths.map(p => Number(p.getAttribute('stroke-opacity')))).toEqual([
    expect.closeTo(0.32, 2),
    expect.closeTo(0.32, 2),
  ])
})

function pairModel(overrides: Partial<ShapeDisplayModel>) {
  const [shared] = shapesOf(bnd('a', 100, 900))
  return chordModel('ready', {
    shapes: [shared!],
    shapeFor: id => (id === 'a' || id === 'a-mate' ? shared : undefined),
    ...overrides,
  })
}

test('selecting the second record of a breakend pair draws the chord the pair shares as selected', () => {
  const { container } = render(
    <svg>
      <ChordVariantDisplay
        display={pairModel({ selectedFeatureId: 'a-mate' })}
      />
    </svg>,
  )
  const paths = [...container.querySelectorAll('path')]
  expect(paths.map(p => p.dataset.testid)).toEqual(['chord-a'])
  expect(paths[0]!.getAttribute('stroke')).toBe(
    resolvePalette().highlight.main.toLowerCase(),
  )
})

test('a pair hovered through one record and selected through the other draws its chord once, hovered', () => {
  const { container } = render(
    <svg>
      <ChordVariantDisplay
        display={pairModel({
          hoveredFeatureId: 'a',
          selectedFeatureId: 'a-mate',
        })}
      />
    </svg>,
  )
  const paths = [...container.querySelectorAll('path')]
  expect(paths).toHaveLength(1)
  expect(paths[0]!.getAttribute('stroke-width')).toBe('3')
})
