import PluginManager from '@jbrowse/core/PluginManager'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { SimpleFeature } from '@jbrowse/core/util'
import { act, render } from '@testing-library/react'

import configSchemaF from '../ChordVariantDisplay/models/configSchema.ts'
import ShapeDisplay from './ShapeDisplay.tsx'
import ShapePaths from './ShapePaths.tsx'

import type { ChordCell } from './chordMarks.ts'
import type { ChordShape, RibbonShape } from './shapes.ts'
import type { ShapeDisplayModel } from './types.ts'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'

const configuration = configSchemaF(new PluginManager()).create({
  type: 'ChordVariantDisplay',
  displayId: 'sv-ChordVariantDisplay',
})

const TESTID = 'shapeRenderer'

function model(
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
    shapesTestId: TESTID,
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
    shapeLabel: () => 'a shape',
    openErrorDialog: () => {},
    reload: () => {},
    ...overrides,
  }
}

function attrs(display: ShapeDisplayModel) {
  const { container } = render(
    <svg>
      <ShapeDisplay display={display} />
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

function bnd(uniqueId: string, start: number, mate: number) {
  return new SimpleFeature({
    uniqueId,
    refName: 'chr1',
    start,
    end: start + 1,
    ALT: [`C]chr1:${mate}]`],
  })
}

function chordsOf(...features: SimpleFeature[]): ChordShape[] {
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

function alignment(strand: number, uniqueId: string) {
  return new SimpleFeature({
    uniqueId,
    assemblyName: 'hg38',
    refName: 'chr1',
    start: 1000,
    end: 3000,
    strand,
    mate: { assemblyName: 'mm39', refName: 'chr1', start: 2000, end: 5000 },
  })
}

function ribbonsOf(...features: SimpleFeature[]): RibbonShape[] {
  return features.map(feature => ({
    kind: 'ribbon',
    feature,
    angles:
      feature.get('strand') === -1
        ? { a1: 1, a2: 3, m1: 5, m2: 8 }
        : { a1: 1, a2: 3, m1: 8, m2: 5 },
    fill: '#4682b4',
    opacity: 1,
  }))
}

// `PENDING_DISPLAYS` (@jbrowse/browser-test-utils) is
// `[data-display-drawn="false"]`, so a display publishing only a phase is
// counted as zero pending displays rather than as one — a circular view with an
// unpainted chord track read as finished, and `displayPainted` had nothing to
// target.
test('an unpainted chord track is pending, not absent', () => {
  expect(attrs(model('loading'))).toEqual({
    testid: 'circular-chord-display',
    id: 'sv-ChordVariantDisplay',
    drawn: 'false',
    phase: 'loading',
  })
})

// the canvas holds the display's cell, so its frame is drawn when the canvas
// has painted that cell and not before; a ready display with no cell has
// nothing left to paint
test('a ready display is drawn once the canvas has painted its cell', () => {
  const cell = { kind: 'ribbon' } as ChordCell
  const drawnWith = (painted: boolean) =>
    attrs(
      model('ready', {
        chordCell: cell,
        view: {
          offsetRadians: 0,
          chordDisplays: [],
          chordPass: {
            drew: c => painted && c === cell,
            renderError: undefined,
          },
        },
      }),
    ).drawn
  expect(drawnWith(false)).toBe('false')
  expect(drawnWith(true)).toBe('true')
  expect(attrs(model('ready'))).toEqual({
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
    attrs(model('error', { displayError: new Error('adapter fell over') })),
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
    model('error', {
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
      <ShapeDisplay display={failing('a')} />
      <ShapeDisplay display={failing('c')} />
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

function renderPastLoadingDelay(ui: React.ReactElement) {
  jest.useFakeTimers()
  try {
    const result = render(ui)
    act(() => {
      jest.advanceTimersByTime(400)
    })
    return result
  } finally {
    jest.useRealTimers()
  }
}

test('a loading chord track says which phase it is in, and how far', () => {
  const { container } = renderPastLoadingDelay(
    <svg>
      <ShapeDisplay
        display={model('loading', {
          statusMessage: 'Downloading variants',
          statusProgress: 0.42,
        })}
      />
    </svg>,
  )
  expect(container.querySelector('text')?.textContent).toBe(
    'Downloading variants 42%',
  )
})

test('an indeterminate phase reads as its label, and no status as Loading', () => {
  const textOf = (overrides: Partial<ShapeDisplayModel>) =>
    renderPastLoadingDelay(
      <svg>
        <ShapeDisplay display={model('loading', overrides)} />
      </svg>,
    ).container.querySelector('text')?.textContent
  expect(textOf({ statusMessage: 'Processing features' })).toBe(
    'Processing features…',
  )
  expect(textOf({})).toBe('Loading…')
})

test('a second loading track adds a line under the first, not another spinner', () => {
  const chordDisplays = [
    { id: 'a', displayPhase: 'loading' as const },
    { id: 'b', displayPhase: 'loading' as const },
  ]
  const loading = (id: string, statusMessage: string) =>
    model('loading', {
      id,
      statusMessage,
      view: {
        offsetRadians: 0,
        chordDisplays,
        chordPass: { drew: () => true, renderError: undefined },
      },
    })
  const { container } = renderPastLoadingDelay(
    <svg>
      <ShapeDisplay display={loading('a', 'Downloading variants')} />
      <ShapeDisplay display={loading('b', 'Downloading features')} />
    </svg>,
  )
  const [first, second] = container.querySelectorAll('[data-display-phase]')
  expect(first!.querySelectorAll('circle').length).toBeGreaterThan(0)
  expect(second!.querySelector('circle')).toBeNull()
  expect(first!.querySelector('text')?.getAttribute('y')).toBe('0em')
  expect(second!.querySelector('text')?.getAttribute('y')).toBe('3em')
  expect(second!.querySelector('text')?.textContent).toBe(
    'Downloading features…',
  )
})

// the canvas holds the resting shapes, so the screen draws only what it
// highlights, while the group counts every one
test('on screen only the hovered and selected shapes are paths', () => {
  const { container } = render(
    <svg>
      <ShapeDisplay
        display={model('ready', {
          shapes: ribbonsOf(
            alignment(1, 'a'),
            alignment(1, 'b'),
            alignment(-1, 'c'),
          ),
          hoveredFeatureId: 'a',
          selectedFeatureId: 'c',
        })}
      />
    </svg>,
  )
  const g = container.querySelector<SVGElement>(
    `[data-testid="${CSS.escape(TESTID)}"]`,
  )!
  expect(g.dataset.chordCount).toBe('3')
  expect(
    [...container.querySelectorAll('path')].map(p => p.dataset.testid),
  ).toEqual(['ribbon-a', 'ribbon-c'])
  expect(container.querySelector('path')!.getAttribute('d')).toMatch(/^M .* Z$/)
})

// a capture waits for the display's frame to be visible, and with nothing
// highlighted the canvas holds every shape, so the group's extent is its disc
test('on screen the renderer group spans its disc with nothing highlighted', () => {
  const { container } = render(
    <svg>
      <ShapeDisplay display={model('ready')} />
    </svg>,
  )
  const g = container.querySelector(`[data-testid="${CSS.escape(TESTID)}"]`)!
  expect(g.querySelector('circle')?.getAttribute('r')).toBe('100')
  expect(g.querySelectorAll('path')).toHaveLength(0)
})

function exported(overrides: Partial<ShapeDisplayModel>) {
  const { container } = render(
    <svg>
      <ShapePaths
        display={model('ready', overrides)}
        testid={TESTID}
        only="all"
      />
    </svg>,
  )
  return [...container.querySelectorAll('path')]
}

// a hover and a selection say where the reader's pointer was, so the export
// draws both ribbons in their resting fill
test('the export leaves a hovered or selected ribbon in its resting fill', () => {
  const fills = exported({
    shapes: ribbonsOf(alignment(1, 'a'), alignment(1, 'b')),
    hoveredFeatureId: 'a',
    selectedFeatureId: 'b',
  }).map(p => p.getAttribute('fill'))
  expect(fills).toEqual(['#4682b4', '#4682b4'])
})

test('the export dims the chords in the dimmed set, and with no set none', () => {
  const opacities = (overrides: Partial<ShapeDisplayModel>) =>
    exported({
      shapes: chordsOf(bnd('a', 100, 900), bnd('b', 200, 800)),
      ...overrides,
    }).map(p => p.getAttribute('opacity'))
  expect(opacities({})).toEqual([null, null])
  expect(opacities({ dimmedFeatureIds: new Set(['a']) })).toEqual([
    '0.15',
    null,
  ])
})

test("the export draws each chord at the display's opacity, over its color's alpha and the dimming", () => {
  const paths = exported({
    shapes: chordsOf(bnd('a', 100, 900), bnd('b', 200, 800)),
    shapeAlpha: 0.45,
    dimmedFeatureIds: new Set(['a']),
  })
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
  const [shared] = chordsOf(bnd('a', 100, 900))
  return model('ready', {
    shapes: [shared!],
    shapeFor: id => (id === 'a' || id === 'a-mate' ? shared : undefined),
    ...overrides,
  })
}

test('selecting the second record of a breakend pair draws the chord the pair shares as selected', () => {
  const { container } = render(
    <svg>
      <ShapeDisplay display={pairModel({ selectedFeatureId: 'a-mate' })} />
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
      <ShapeDisplay
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
