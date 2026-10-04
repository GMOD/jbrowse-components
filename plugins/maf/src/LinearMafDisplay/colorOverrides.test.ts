import { setConf } from '@jbrowse/core/configuration'
import { packAbgr } from '@jbrowse/core/util/colorBits'
import { colorRampStops } from '@jbrowse/core/util/colorRamp'
import { autorun } from 'mobx'

import { testWireRegionData } from '../LinearMafGetAlignmentDataRpc/testWire.ts'
import { identityLut } from '../LinearMafRenderer/identity.ts'
import { emptyMafCoverage } from './components/coverageTestFixture.ts'
import { createMafTestEnvironment, stageDetailRegion } from './testEnv.ts'

import type { LinearMafDisplayModel } from './stateModel.ts'

const GREY = packAbgr(140, 140, 140, 255)

function displayWith(color: unknown) {
  const { display, view } = createMafTestEnvironment({
    displayConfig: { color, rowIdentityAutoZoom: false },
  }).createDisplay()
  view.zoomTo(16)
  view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
  return display
}

// one row whose first block matches the reference and whose second differs at
// every base, so the heatmap paints the two ends of the ramp
function stageTwoIdentities(display: LinearMafDisplayModel) {
  display.setSamples({
    samples: [{ id: 'sp1', label: 'sp1' }],
    treeNewick: undefined,
    samplesCanonical: true,
  })
  stageDetailRegion(
    display,
    0,
    testWireRegionData(
      [
        {
          startBp: 0,
          refSeq: 'A'.repeat(64),
          rows: [{ sampleId: 'sp1', seq: 'A'.repeat(64), chr: 'chrA' }],
        },
        {
          startBp: 64,
          refSeq: 'A'.repeat(64),
          rows: [{ sampleId: 'sp1', seq: 'C'.repeat(64), chr: 'chrB' }],
        },
      ],
      { coverage: emptyMafCoverage(0), refSampleId: undefined },
    ),
  )
}

function heatmapColors(display: LinearMafDisplayModel) {
  return [...(display.encodedUpload.get(0)!.identity!.color as Uint32Array)]
}

describe('identity', () => {
  test('unwritten, the ramp is the one the pins hold', () => {
    expect(displayWith('identity').identityColors).toBe(identityLut())
  })

  test('domainMin stretches the ramp over close relatives', () => {
    const colors = displayWith({
      field: 'identity',
      domainMin: 0.7,
    }).identityColors
    const lowest = identityLut()[0]
    expect(colors[0]).toBe(lowest)
    expect(colors[70]).toBe(lowest)
    expect(colors[85]).toBe(GREY)
    expect(colors[100]).toBe(identityLut()[100])
  })

  test('domainMid moves the grey middle', () => {
    expect(
      displayWith({ field: 'identity', domainMid: 0.9 }).identityColors[90],
    ).toBe(GREY)
  })

  test('a scheme replaces the ramp, reversed where asked', () => {
    const [first] = colorRampStops({ scheme: 'viridis' })
    const [last] = colorRampStops({ scheme: 'viridis', reverse: true })
    const plain = displayWith({ field: 'identity', scheme: 'viridis' })
    const turned = displayWith({
      field: 'identity',
      scheme: 'viridis',
      reverse: true,
    })
    expect(plain.identityColors[0]).toBe(packAbgr(...first!))
    expect(turned.identityColors[0]).toBe(packAbgr(...last!))
  })

  test('the heatmap paints through it', () => {
    const display = displayWith({ field: 'identity', scheme: 'viridis' })
    stageTwoIdentities(display)
    expect(heatmapColors(display)).toEqual([
      display.identityColors[100],
      display.identityColors[0],
    ])
  })

  test('the key spans the written domain in the colours it paints', () => {
    const display = displayWith({ field: 'identity', domainMin: 0.7 })
    expect(display.colorScales[0]).toMatchObject({
      kind: 'ramp',
      domain: [0.7, 1],
      stops: [
        { offset: 0, color: 'rgb(199,67,56)' },
        { offset: 0.5, color: 'rgb(140,140,140)' },
        { offset: 1, color: 'rgb(47,102,176)' },
      ],
    })
  })

  test('renaming the key re-encodes nothing, and moving the ramp does', () => {
    const display = displayWith('identity')
    stageTwoIdentities(display)
    const dispose = autorun(() => {
      void display.encodedUpload
    })
    const before = display.encodedUpload
    setConf(display, 'color', { field: 'identity', title: 'Identity' })
    expect(display.encodedUpload).toBe(before)
    setConf(display, 'color', { field: 'identity', domainMin: 0.5 })
    expect(display.encodedUpload).not.toBe(before)
    dispose()
  })

  test('the SVG export encodes through the same colours', () => {
    const display = displayWith({ field: 'identity', domainMin: 0.7 })
    expect(display.rowsEncodePropsIn(display.colorPalette).identityColors).toBe(
      display.identityColors,
    )
  })
})
