import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { waitFor } from '@testing-library/react'

import { createTestEnvironment } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// What a right-click resolves to, and what the menu then offers for it. The
// resolution lives on the model beside `featureAt` rather than in the component
// that binds the handler: it is the same question about the same pixel, and the
// component's copy re-derived `pxToBp`, the sidebar bound and the painted base
// that `featureAt` was about to derive again.

const CTGA_1KB = [
  { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
]

function region(): MultiRowRegionData {
  return {
    featureStarts: Uint32Array.from([100, 300]),
    featureEnds: Uint32Array.from([200, 400]),
    featureColors: Uint32Array.from([
      cssColorToABGR('red'),
      cssColorToABGR('blue'),
    ]),
    featureDeltas: new Int32Array(0),
    partitionValues: ['a', 'b'],
    featurePartitionIndex: Uint32Array.from([0, 1]),
    featureNames: ['top', 'bottom'],
    featureIds: ['f0', 'f1'],
    usedItemRgb: false,
    partitionCandidates: [],
    partitionCandidateValues: [],
    legendCandidates: [],
    resolvedPartitionField: 'name',
  }
}

function setup(regions = CTGA_1KB) {
  const { display } = createTestEnvironment().createDisplay(regions)
  display.setRpcData(0, region())
  return display
}

type Display = ReturnType<typeof setup>

function row(display: Display, label: string) {
  const item: MenuItem | undefined = display
    .contextMenuItems()
    .find(i => 'label' in i && i.label === label)
  if (!item || !('onClick' in item)) {
    throw new Error(`no clickable menu row "${label}"`)
  }
  return item
}

describe('contextTargetAt', () => {
  it('carries the clicked base and the feature there', () => {
    const display = setup()
    // two rows in the default 100px display, so row 1's band starts at 50px
    expect(display.contextTargetAt(350, 75)).toMatchObject({
      refName: 'ctgA',
      pos: 350,
      hit: { id: 'f1', rowName: 'b' },
    })
  })

  it('carries the position alone where the click missed every block', () => {
    const display = setup()
    // "Sort rows by color here" acts on the column, so a click in a gap still
    // opens a menu — it just has no feature rows
    expect(display.contextTargetAt(250, 10)).toMatchObject({
      refName: 'ctgA',
      pos: 250,
      hit: undefined,
    })
  })

  // The two dead zones, which is what the component needs in order to decide
  // whether to preventDefault: a right-click there must fall through to the
  // browser rather than open an empty JBrowse menu.
  it('resolves nothing past the end of the displayed regions', () => {
    const display = setup([
      { refName: 'ctgA', start: 0, end: 200, assemblyName: 'volvox' },
    ])
    // 800px of view over 200bp, so most of it is off the end
    expect(display.contextTargetAt(500, 10)).toBeUndefined()
  })

  it('resolves nothing over the tree sidebar, which owns its own menu', () => {
    const display = setup()
    display.setLayoutAndClusterTree(
      [{ name: 'a' }, { name: 'b' }],
      '(a:1,b:1);',
    )
    const edge = display.sidebarOffset + 4

    expect(display.contextTargetAt(edge - 1, 10)).toBeUndefined()
    expect(display.contextTargetAt(edge, 10)).toBeDefined()
  })
})

describe('multi-row feature context menu', () => {
  it('copies the clicked block as a locString', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    })
    const display = setup()
    display.openContextMenu({
      clientX: 0,
      clientY: 0,
      ...display.contextTargetAt(350, 75)!,
    })

    row(display, 'Copy location').onClick()

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('ctgA:301..400')
    })
  })

  it('offers no feature rows where the click missed every block', () => {
    const display = setup()
    display.openContextMenu({
      clientX: 0,
      clientY: 0,
      ...display.contextTargetAt(250, 10)!,
    })

    const labels = display
      .contextMenuItems()
      .map(i => ('label' in i ? i.label : ''))
    expect(labels).not.toContain('Copy location')
    expect(labels).not.toContain('Open feature details')
    expect(labels).toContain('Sort rows by color here')
  })
})
