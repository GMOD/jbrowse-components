import PluginManager from '@jbrowse/core/PluginManager'
import { SimpleFeature } from '@jbrowse/core/util'
import { fireEvent, render } from '@testing-library/react'

import { Slice } from '../../CircularView/slices.ts'
import configSchemaF from '../models/configSchema.ts'
import ChordSyntenyDisplay from './ChordSyntenyDisplay.tsx'

import type { RibbonDisplayModel } from '../../chords/types.ts'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'

// the default color slot is a jexl expression over the strand, so the config
// needs the manager that owns the jexl instance
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

function alignment(strand: number) {
  return new SimpleFeature({
    uniqueId: 'aln1',
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

function ribbonModel(
  phase: DisplayStatusPhase,
  overrides: Partial<RibbonDisplayModel> = {},
): RibbonDisplayModel {
  return {
    error: undefined,
    view: { offsetRadians: 0 },
    ready: phase === 'ready',
    displayPhase: phase,
    svgReady: phase !== 'loading',
    features: [],
    selectedFeatureId: undefined,
    configuration,
    radiusPx: 1000,
    bezierRadius: 100,
    sliceFor: (assemblyName, refName) =>
      slices[`${assemblyName} ${refName}` as keyof typeof slices],
    onRibbonClick: () => {},
    openErrorDialog: () => {},
    reload: () => {},
    ...overrides,
  }
}

function draw(model: RibbonDisplayModel) {
  return render(
    <svg>
      <ChordSyntenyDisplay display={model} />
    </svg>,
  )
}

function attrs(model: RibbonDisplayModel) {
  const { container } = draw(model)
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
    attrs(ribbonModel('error', { error: new Error('adapter fell over') })),
  ).toEqual({
    testid: 'circular-chord-display',
    id: 'paf-ChordSyntenyDisplay',
    drawn: 'true',
    phase: 'error',
  })
})

// each end resolves against its own assembly's slices, which is what a
// two-assembly circle needs: both sides here are named chr1
test('an alignment across two assemblies draws one ribbon', () => {
  const { container } = draw(ribbonModel('ready', { features: [alignment(1)] }))
  const paths = container.querySelectorAll('path')
  expect(paths).toHaveLength(1)
  expect(paths[0]!.getAttribute('d')).toMatch(/^M .* Z$/)
})

test('an end whose slice is off the circle drops the ribbon', () => {
  const { container } = draw(
    ribbonModel('ready', {
      features: [alignment(1)],
      sliceFor: assemblyName =>
        assemblyName === 'hg38' ? slices['hg38 chr1'] : undefined,
    }),
  )
  expect(container.querySelectorAll('path')).toHaveLength(0)
})

test('clicking a ribbon hands the feature to the display', () => {
  const clicked: string[] = []
  const { container } = draw(
    ribbonModel('ready', {
      features: [alignment(-1)],
      onRibbonClick: feature => {
        clicked.push(feature.id())
      },
    }),
  )
  fireEvent.click(container.querySelector('path')!)
  expect(clicked).toEqual(['aln1'])
})
