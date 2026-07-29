import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment, rightClick } from './testEnv.ts'

import type { SubfeatureInfo } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { MenuItem } from '@jbrowse/core/ui'

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

type Display = ReturnType<
  ReturnType<typeof createTestEnvironment>['createDisplay']
>['display']

function flatten(items: MenuItem[]): MenuItem[] {
  return items.flatMap(m => ('subMenu' in m ? flatten(m.subMenu) : [m]))
}

function menuLabels(display: Display) {
  return flatten(display.contextMenuItems()).map(m =>
    'label' in m ? m.label : '',
  )
}

function open(display: Display, hgvsLabel?: string, tooltipText?: string) {
  display.setRpcData(
    0,
    makeFeatureData({ flatbushItems: [gene], subfeatureInfos: [transcript] }),
    10,
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

    expect(menuLabels(display)).toContain('Copy HGVS position (EDEN.1:c.93+1)')
  })

  // Absent rather than disabled: zoomed out, or off a transcript, there is no
  // honest position to offer.
  it('offers nothing when the click resolved no position', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    open(display)

    expect(
      menuLabels(display).some(l => String(l).startsWith('Copy HGVS')),
    ).toBe(false)
    // the rest of the menu is unaffected
    expect(menuLabels(display)).toContain('Open feature details')
  })
})

describe('Copy tooltip context menu item', () => {
  it('offers a tooltip copy when the hit resolved tooltip text', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    open(display, undefined, 'EDEN.1\nexon 2/3 c.93+1')

    expect(menuLabels(display)).toContain('Copy tooltip text')
  })

  // Absent rather than disabled: nothing to copy when the hit resolved no
  // tooltip content.
  it('offers nothing when the hit resolved no tooltip text', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    open(display)

    expect(menuLabels(display)).not.toContain('Copy tooltip text')
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

    expect(menuLabels(display)).toContain('Copy EDEN.1 attributes (JSON)')
    expect(menuLabels(display)).toContain('Copy EDEN attributes (JSON)')
  })
})
