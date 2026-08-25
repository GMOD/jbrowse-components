import LinearDerivativeVsRefMenuItemF from '../LinearDerivativeVsRef/index.ts'
import { createDisplay } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

function labels(items: MenuItem[]): unknown[] {
  return items.flatMap(i => [
    ...('label' in i ? [i.label] : []),
    ...('subMenu' in i ? labels(i.subMenu) : []),
  ])
}

test('the track menu offers the reconstruction on a synteny display', () => {
  const display = createDisplay({ extend: LinearDerivativeVsRefMenuItemF })
  expect(labels(display.trackMenuItems() as MenuItem[])).toContain(
    'Reconstruct derivative allele...',
  )
})

test('a route here is a contig, and one contig is enough', () => {
  expect(createDisplay().derivativePathEvidence).toEqual({
    noun: 'contigs',
    minReads: 1,
    namesOffScreenSegments: false,
  })
})
