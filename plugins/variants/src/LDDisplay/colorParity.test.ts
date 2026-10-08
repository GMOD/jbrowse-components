import { setConf } from '@jbrowse/core/configuration'
import { MockHal } from '@jbrowse/render-core/hal'
import { GpuMarkBackend } from '@jbrowse/render-core/marks/backend'
import { canvasWideBlocks } from '@jbrowse/render-core/renderBlock'

import { LD_MARKS } from './components/ldMarks.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { LDMetric } from '../VariantRPC/ldTypes.ts'
import type { LDUploadData } from './components/ldRenderingBackendTypes.ts'

function fnv1a(bytes: Uint8Array) {
  let h = 0x811c9dc5
  for (const b of bytes) {
    h = Math.imul(h ^ b, 0x01000193) >>> 0
  }
  return h.toString(16)
}

const BEFORE = {
  r2: {
    lutHash: 'c424bc79',
    title: 'R²',
    stops: [
      'rgb(255,245,240)',
      'rgb(254,228,216)',
      'rgb(253,202,181)',
      'rgb(252,170,141)',
      'rgb(252,138,106)',
      'rgb(251,105,74)',
      'rgb(241,68,50)',
      'rgb(217,37,35)',
      'rgb(188,20,26)',
      'rgb(152,12,19)',
      'rgb(103,0,13)',
    ],
  },
  dprime: {
    lutHash: 'bf086e',
    title: "D'",
    stops: [
      'rgb(247,251,255)',
      'rgb(227,238,248)',
      'rgb(208,225,242)',
      'rgb(181,212,233)',
      'rgb(148,196,223)',
      'rgb(106,174,214)',
      'rgb(74,152,201)',
      'rgb(46,126,188)',
      'rgb(23,100,171)',
      'rgb(8,74,145)',
      'rgb(8,48,107)',
    ],
  },
} as const

function displayDrawing(metric: LDMetric) {
  const { display } = createTestEnvironment().createDisplay()
  setConf(display, ['color', 'field'], metric)
  display.setShowLegend(true)
  return display
}

function boundRamp(metric: LDMetric) {
  const display = displayDrawing(metric)
  const data: LDUploadData = {
    boundaries: new Float32Array([0, 10, 20]),
    ldValues: new Float32Array([0.5]),
    numCells: 1,
    band: 1_000_000,
    uniformW: 10,
  }
  const hal = new MockHal(LD_MARKS.map(m => m.pass))
  const backend = new GpuMarkBackend(hal, LD_MARKS)
  backend.upload(0, data)
  backend.renderBlocks(
    canvasWideBlocks([0], 800),
    new Map([[0, data]]),
    display.renderState,
  )
  return hal.getTexture('main') as Uint8Array
}

describe.each(['r2', 'dprime'] as const)('a default %s track', metric => {
  test('binds the ramp it bound before, byte for byte', () => {
    expect(fnv1a(boundRamp(metric))).toBe(BEFORE[metric].lutHash)
  })

  test('samples it at the raw value, the domain being 0 to 1', () => {
    expect(displayDrawing(metric).renderState).toMatchObject({
      domainMin: 0,
      domainMax: 1,
    })
  })

  test('keys the ramp it keyed before', () => {
    const { title, stops } = BEFORE[metric]
    expect(displayDrawing(metric).legendSpec.sections).toEqual([
      {
        id: 'ld',
        title,
        items: [
          {
            label: title,
            gradient: {
              stops: stops.map((color, i) => ({
                offset: i / 10,
                color,
                opacity: 1,
              })),
              minLabel: '0',
              maxLabel: '1',
            },
          },
        ],
      },
    ])
  })
})
