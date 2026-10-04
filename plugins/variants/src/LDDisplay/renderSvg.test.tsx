import { act } from 'react'

import { render } from '@testing-library/react'

import { renderSvg } from './renderSvg.tsx'
import { createTestEnvironment } from './testEnv.ts'

import type { LDDataResult } from '../RenderLDDataRPC/types.ts'

jest.mock('@jbrowse/core/svg/svgReady', () => ({
  ...jest.requireActual('@jbrowse/core/svg/svgReady'),
  awaitSvgReady: () => Promise.resolve(),
}))

function ldData(n: number, widthBp: number, originBp: number): LDDataResult {
  return {
    snps: Array.from({ length: n }, (_, i) => ({
      id: `rs${i}`,
      refName: 'ctgA',
      start: i * 1000,
      end: i * 1000 + 1,
    })),
    ldValues: new Float32Array((n * (n - 1)) / 2),
    boundaries: new Float32Array(n + 1),
    numCells: (n * (n - 1)) / 2,
    band: 1_000_000,
    uniformW: widthBp / (n * Math.SQRT2),
    originBp,
    genomicMode: false,
    metric: 'r2',
    hasR2: true,
    hasDprime: true,
  }
}

// A live figure (`useViewSvgFigure`) mounts the export in the page and freezes
// it against one snapshot, so nothing in it may follow the view: a pan that
// moved the labels and connector lines would slide them across the triangle
// drawn before it.
test('the exported labels and connector lines hold still while the view pans', async () => {
  const { display, view } = createTestEnvironment().createDisplay()
  view.zoomTo(10)
  const width = view.dynamicBlocks.totalWidthPxWithoutBorders
  const block = view.dynamicBlocks.contentBlocks[0]!
  display.setRpcData(ldData(4, width * view.bpPerPx, block.start))
  display.setShowLabels(true)

  const { container } = render(<svg>{await renderSvg(display, {})}</svg>)
  const drawn = container.innerHTML
  expect(drawn).toContain('>rs0<')
  expect(container.querySelectorAll('path').length).toBeGreaterThan(0)

  act(() => {
    view.scrollTo(300)
  })
  expect(container.innerHTML).toBe(drawn)
})
