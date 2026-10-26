import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { SyntenyViewMixin } from './SyntenyViewMixin.ts'

function strandView(snapshot: Record<string, unknown> = {}) {
  return SyntenyViewMixin({ defaultOpacity: 1 })
    .views(() => ({
      syntenyTracks() {
        return []
      },
      colorSurface() {
        return 'points' as const
      },
    }))
    .create({ encoding: { color: 'strand' }, ...snapshot })
}

test('the key draws until legend.show is false', () => {
  expect(strandView().showLegend).toBe(true)
  expect(strandView({ legend: { show: false } }).showLegend).toBe(false)
})

test("the key's close button hides it for this mode and saves nothing", () => {
  const view = strandView()
  view.setShowLegend(false)
  expect(view.showLegend).toBe(false)
  expect((getSnapshot(view) as { legend?: unknown }).legend).toBeUndefined()
})

test('showing the legend writes legend.show and brings back a closed key', () => {
  const view = strandView()
  view.dismissLegendSection()
  view.setLegendShow(false)
  expect(getSnapshot(view.legend)).toEqual({ show: false })
  view.setLegendShow(true)
  expect(view.showLegend).toBe(true)
})
