import { waitFor } from '@testing-library/react'

import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import {
  clickContextMenuItem,
  contextMenuLabels,
  createTestEnvironment,
  rightClick,
} from './testEnv.ts'

import type { SubfeatureInfo } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { TestDisplay } from './testEnv.ts'

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }

const gene = makeFlatbushItem({
  featureId: 'EDEN',
  type: 'gene',
  name: 'EDEN',
  startBp: 1050,
  endBp: 9000,
})

const transcript: SubfeatureInfo = {
  kind: 'subfeature',
  featureId: 'EDEN.1',
  type: 'mRNA',
  startBp: 1050,
  endBp: 9000,
  topPx: 0,
  bottomPx: 10,
  parentFeatureId: 'EDEN',
  displayLabel: 'EDEN.1',
}

function open(display: TestDisplay, hgvsLabel?: string, tooltipText?: string) {
  display.setRpcData(
    0,
    makeFeatureData({ flatbushItems: [gene], subfeatureInfos: [transcript] }),
    ctgA,
  )
  display.setLoadedRegion(0, ctgA)
  rightClick(display, gene, transcript, { hgvsLabel, tooltipText })
}

describe('HGVS position context menu', () => {
  // The value is in the label rather than behind a generic "Copy HGVS
  // position", so what lands on the clipboard is visible before clicking.
  it('offers the clicked position, naming it in the label', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    open(display, 'EDEN.1:c.93+1')

    expect(contextMenuLabels(display)).toContain(
      'Copy HGVS position (EDEN.1:c.93+1)',
    )
  })

  // Absent rather than disabled: zoomed out, or off a transcript, there is no
  // honest position to offer.
  it('offers nothing when the click resolved no position', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    open(display)

    expect(
      contextMenuLabels(display).some(l => String(l).startsWith('Copy HGVS')),
    ).toBe(false)
    // the rest of the menu is unaffected
    expect(contextMenuLabels(display)).toContain('Open feature details')
  })
})

describe('Copy tooltip context menu item', () => {
  it('offers a tooltip copy when the hit resolved tooltip text', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    open(display, undefined, 'EDEN.1\nexon 2/3 c.93+1')

    expect(contextMenuLabels(display)).toContain('Copy tooltip text')
  })

  // Absent rather than disabled: nothing to copy when the hit resolved no
  // tooltip content.
  it('offers nothing when the hit resolved no tooltip text', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    open(display)

    expect(contextMenuLabels(display)).not.toContain('Copy tooltip text')
  })
})

describe('Copy location context menu item', () => {
  // The one row here whose value gets pasted somewhere rather than read, so it
  // is written the way the location box reads it back: 1-based, closed.
  it('copies the feature span as a locString', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    // copyToClipboard gates the async API on this and otherwise falls back to
    // execCommand, which jsdom does not implement
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    })
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    open(display)

    expect(contextMenuLabels(display)).toContain('Copy location')
    clickContextMenuItem(display, 'Copy location')

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('ctgA:1,051..9,000')
    })
  })

  // The refName naming the span comes off the loaded region, so a hit whose
  // region has been pruned has no honest location to offer.
  it('offers nothing when the hit region is no longer loaded', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    rightClick(display, gene)

    expect(contextMenuLabels(display)).not.toContain('Copy location')
  })
})

describe('Feature info (JSON) copy', () => {
  // Unlike the position and tooltip copies, this doesn't depend on the hit
  // resolving a base or any text — the isoform and the gene it belongs to
  // are always both available to copy.
  it('offers both the subfeature and the whole feature, named individually', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    open(display)

    expect(contextMenuLabels(display)).toContain(
      'Copy EDEN.1 attributes (JSON)',
    )
    expect(contextMenuLabels(display)).toContain('Copy EDEN attributes (JSON)')
  })
})
