import PluginManager from '@jbrowse/core/PluginManager'
import { SimpleFeature } from '@jbrowse/core/util'
import { render } from '@testing-library/react'

import { Slice } from '../../CircularView/slices.ts'
import ShapePaths from '../../chords/ShapePaths.tsx'
import { ribbonShape } from '../../chords/shapes.ts'
import configSchemaF from '../models/configSchema.ts'
import ChordSyntenyDisplay from './ChordSyntenyDisplay.tsx'

import type { RibbonDisplayModel } from '../../chords/types.ts'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'

// the hover and selected slots take jexl, so the config needs the manager that
// owns the jexl instance
const pluginManager = new PluginManager()
const configuration = configSchemaF(pluginManager).create(
  { type: 'ChordSyntenyDisplay', displayId: 'paf-ChordSyntenyDisplay' },
  { pluginManager },
)

function block(refName: string, assemblyName: string, offsetRadians: number) {
  return new Slice(
    { bpPerRadian: 1000 },
    {
      elided: false,
      widthBp: 10000,
      start: 0,
      end: 10000,
      refName,
      assemblyName,
    },
    offsetRadians,
  )
}

const slices = {
  'hg38 chr1': block('chr1', 'hg38', 0),
  'mm39 chr1': block('chr1', 'mm39', 3),
}

const sliceFor = (assemblyName: string | undefined, refName: string) =>
  slices[`${assemblyName} ${refName}` as keyof typeof slices]

function alignment(strand: number, uniqueId = 'aln1') {
  return new SimpleFeature({
    uniqueId,
    assemblyName: 'hg38',
    refName: 'chr1',
    start: 1000,
    end: 3000,
    strand,
    mate: {
      assemblyName: 'mm39',
      refName: 'chr1',
      start: 2000,
      end: 5000,
    },
  })
}

function shapesOf(...features: SimpleFeature[]) {
  return features.flatMap(feature => {
    const shape = ribbonShape({
      feature,
      sliceFor,
      radius: 1000,
      fill: '#4682b4',
    })
    return shape ? [shape] : []
  })
}

function ribbonModel(
  phase: DisplayStatusPhase,
  overrides: Partial<RibbonDisplayModel> = {},
): RibbonDisplayModel {
  return {
    id: 'paf',
    error: undefined,
    displayError: undefined,
    view: { offsetRadians: 0 },
    ready: phase === 'ready',
    displayPhase: phase,
    svgReady: phase !== 'loading',
    drawnFeatures: [],
    shapes: [],
    shapeAlpha: 0.25,
    selectedFeatureId: undefined,
    hoveredFeatureId: undefined,
    configuration,
    radiusPx: 1000,
    bezierRadius: 100,
    sliceFor,
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

// each end resolves against its own assembly's slices, which is what a
// two-assembly circle needs: both sides here are named chr1
test('an alignment across two assemblies is one ribbon', () => {
  expect(shapesOf(alignment(1))).toHaveLength(1)
})

test('an end whose slice is off the circle drops the ribbon', () => {
  expect(
    ribbonShape({
      feature: alignment(1),
      sliceFor: assemblyName =>
        assemblyName === 'hg38' ? slices['hg38 chr1'] : undefined,
      radius: 1000,
      fill: '#4682b4',
    }),
  ).toBeUndefined()
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
