import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { createMafTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// The view's assembly, which is what `referenceSampleId` falls back to before a
// region has named the reference itself.
const REF = 'volvox'

function sample(id: string) {
  return { id, label: id }
}

function makeDisplay(samples: string[]) {
  const { display } = createMafTestEnvironment().createDisplay()
  display.setSamples({
    samples: samples.map(sample),
    treeNewick: `((${samples[0]},${samples[1]}),${samples[2]});`,
    samplesCanonical: true,
  })
  return display
}

function rowNames(d: ReturnType<typeof makeDisplay>) {
  return d.sources.map(s => s.name)
}

// Names of the positioned dendrogram's leaves, in draw order. `leaves` is
// internal to tree-sidebar, and this only has to walk three nodes.
function leafNames(node: {
  data?: { name?: string }
  children?: unknown[] | null
}): string[] {
  const children = node.children as (typeof node)[] | null | undefined
  return children?.length
    ? children.flatMap(c => leafNames(c))
    : [node.data?.name ?? '']
}

// Under the default mismatch coloring the reference's own row matches at every
// column, so it draws as a solid match-colored bar carrying no information.
// UCSC omits it.
test('hiding the reference drops its row and leaves the others in order', () => {
  const display = makeDisplay([REF, 'panTro4', 'mm10'])
  expect(rowNames(display)).toEqual([REF, 'panTro4', 'mm10'])

  display.setShowReferenceRow(false)
  expect(rowNames(display)).toEqual(['panTro4', 'mm10'])
})

// The guide tree still carries the reference's leaf, and
// `computeClusterHierarchy` declines to position a tree that no longer
// describes the rows — so without pruning it too, hiding one row would take the
// whole dendrogram with it.
test('the dendrogram survives the hidden row', () => {
  const display = makeDisplay([REF, 'panTro4', 'mm10'])
  expect(display.hierarchy && leafNames(display.hierarchy)).toEqual([
    REF,
    'panTro4',
    'mm10',
  ])

  display.setShowReferenceRow(false)
  expect(display.hierarchy && leafNames(display.hierarchy)).toEqual([
    'panTro4',
    'mm10',
  ])
})

function findRow(items: MenuItem[], label: string): MenuItem | undefined {
  for (const item of items) {
    if ('label' in item && item.label === label) {
      return item
    }
    if ('subMenu' in item) {
      const hit = findRow(resolveSubMenu(item), label)
      if (hit) {
        return hit
      }
    }
  }
  return undefined
}

function referenceRowItem(d: ReturnType<typeof makeDisplay>) {
  const item = findRow(d.trackMenuItems(), 'Show reference row')
  if (!item) {
    throw new Error('no "Show reference row" item')
  }
  return item as MenuItem & { disabled?: boolean; disabledHelpText?: string }
}

// A MAF can name a reference that is not among `samples` or the guide tree's
// leaves, and there the toggle would be on, correct, and doing nothing.
test('the menu row says when there is no reference row to hide', () => {
  expect(
    referenceRowItem(makeDisplay([REF, 'panTro4', 'mm10'])).disabled,
  ).toBeFalsy()

  const withoutRef = referenceRowItem(makeDisplay(['hg38', 'panTro4', 'mm10']))
  expect(withoutRef.disabled).toBe(true)
  expect(withoutRef.disabledHelpText).toBe(
    'the reference species has no row here',
  )
})
