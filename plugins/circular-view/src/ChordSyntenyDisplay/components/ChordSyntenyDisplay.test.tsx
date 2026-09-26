import PluginManager from '@jbrowse/core/PluginManager'
import { SimpleFeature } from '@jbrowse/core/util'
import { render } from '@testing-library/react'

import ShapePaths from '../../chords/ShapePaths.tsx'
import configSchemaF from '../models/configSchema.ts'
import ChordSyntenyDisplay from './ChordSyntenyDisplay.tsx'

import type { ChordCell } from '../../chords/chordMarks.ts'
import type { RibbonShape } from '../../chords/shapes.ts'
import type { RibbonDisplayModel } from '../../chords/types.ts'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'

// the hover and selected slots take jexl, so the config needs the manager that
// owns the jexl instance
const pluginManager = new PluginManager()
const configuration = configSchemaF(pluginManager).create(
  { type: 'ChordSyntenyDisplay', displayId: 'paf-ChordSyntenyDisplay' },
  { pluginManager },
)

function alignment(strand: number, uniqueId = 'aln1') {
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

function shapesOf(...features: SimpleFeature[]): RibbonShape[] {
  return features.map(feature => ({
    kind: 'ribbon',
    feature,
    angles:
      feature.get('strand') === -1
        ? { a1: 1, a2: 3, m1: 5, m2: 8 }
        : { a1: 1, a2: 3, m1: 8, m2: 5 },
    fill: '#4682b4',
  }))
}

function ribbonModel(
  phase: DisplayStatusPhase,
  overrides: Partial<RibbonDisplayModel> = {},
): RibbonDisplayModel {
  return {
    id: 'paf',
    error: undefined,
    displayError: undefined,
    view: {
      offsetRadians: 0,
      chordPass: { drew: () => true, renderError: undefined },
    },
    ready: phase === 'ready',
    displayPhase: phase,
    svgReady: phase !== 'loading',
    drawnFeatures: [],
    drawnCount: overrides.shapes?.length ?? 0,
    shapes: [],
    shapeFor: id =>
      (overrides.shapes ?? []).find(shape => shape.feature.id() === id),
    chordCell: undefined,
    hitAt: () => undefined,
    shapeAlpha: 0.25,
    selectedFeatureId: undefined,
    hoveredFeatureId: undefined,
    configuration,
    radiusPx: 1000,
    bezierRadius: 100,
    sliceFor: () => undefined,
    clickFeature: () => {},
    shapeLabel: () => 'an alignment',
    openErrorDialog: () => {},
    reload: () => {},
    ...overrides,
  }
}

function attrs(model: RibbonDisplayModel) {
  const { container } = render(
    <svg>
      <ChordSyntenyDisplay display={model} />
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
// `[data-display-drawn="false"]`, so a display publishing only a phase counts
// as zero pending displays rather than one
test('an unpainted synteny track is pending, not absent', () => {
  expect(attrs(ribbonModel('loading'))).toEqual({
    testid: 'circular-chord-display',
    id: 'paf-ChordSyntenyDisplay',
    drawn: 'false',
    phase: 'loading',
  })
})

test('the error terminal is finished rather than pending', () => {
  expect(
    attrs(
      ribbonModel('error', { displayError: new Error('adapter fell over') }),
    ),
  ).toEqual({
    testid: 'circular-chord-display',
    id: 'paf-ChordSyntenyDisplay',
    drawn: 'true',
    phase: 'error',
  })
})

// the canvas holds the display's cell, so its frame is drawn when the canvas
// has painted that cell and not before
test('a ready display is drawn once the canvas has painted its cell', () => {
  const cell = { kind: 'ribbon' } as ChordCell
  const drawnWith = (painted: boolean) =>
    attrs(
      ribbonModel('ready', {
        chordCell: cell,
        view: {
          offsetRadians: 0,
          chordPass: {
            drew: c => painted && c === cell,
            renderError: undefined,
          },
        },
      }),
    ).drawn
  expect(drawnWith(false)).toBe('false')
  expect(drawnWith(true)).toBe('true')
})

// the canvas holds the resting ribbons, so the screen draws only what it
// highlights; the export draws them all, dimmed where the inspector says so
test('on screen only the hovered and selected ribbons are paths', () => {
  const shapes = shapesOf(
    alignment(1, 'a'),
    alignment(1, 'b'),
    alignment(-1, 'c'),
  )
  const { container } = render(
    <svg>
      <ChordSyntenyDisplay
        display={ribbonModel('ready', {
          shapes,
          hoveredFeatureId: 'a',
          selectedFeatureId: 'c',
        })}
      />
    </svg>,
  )
  const g = container.querySelector<SVGElement>(
    '[data-testid="syntenyRibbonRenderer"]',
  )!
  expect(g.dataset.chordCount).toBe('3')
  expect(
    [...container.querySelectorAll('path')].map(p => p.dataset.testid),
  ).toEqual(['ribbon-a', 'ribbon-c'])
  expect(container.querySelector('path')!.getAttribute('d')).toMatch(/^M .* Z$/)
})

// a hover is a screen state: the export draws the selection and never the
// pointer's grey
test('the export leaves a hovered ribbon in its resting fill', () => {
  const { container } = render(
    <svg>
      <ShapePaths
        display={ribbonModel('ready', {
          shapes: shapesOf(alignment(1, 'a'), alignment(1, 'b')),
          hoveredFeatureId: 'a',
          selectedFeatureId: 'b',
        })}
        testid="syntenyRibbonRenderer"
        only="all"
      />
    </svg>,
  )
  const fills = [...container.querySelectorAll('path')].map(p =>
    p.getAttribute('fill'),
  )
  expect(fills[0]).toBe('#4682b4')
  expect(fills[1]).not.toBe('#4682b4')
})

test('the export draws every ribbon and dims those outside the highlighted set', () => {
  const opacities = (overrides: Partial<RibbonDisplayModel>) => {
    const { container } = render(
      <svg>
        <ShapePaths
          display={ribbonModel('ready', {
            shapes: shapesOf(alignment(1, 'a'), alignment(1, 'b')),
            ...overrides,
          })}
          testid="syntenyRibbonRenderer"
          only="all"
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
