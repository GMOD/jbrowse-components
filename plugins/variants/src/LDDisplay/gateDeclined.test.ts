import { getMembers } from '@jbrowse/mobx-state-tree'

import { createTestEnvironment } from './testEnv.ts'

// The method-shaped reactive hooks must stay in `.views()`: as actions MobX runs
// them untracked and callers keep a stale answer (BaseLinearDisplay/CLAUDE.md,
// "`isCacheValid` is a view, not an action").
test('the reactive method hooks are views, not actions', () => {
  const { display } = createTestEnvironment().createDisplay()
  const { actions } = getMembers(display)
  expect(actions).not.toContain('isCacheValid')
  expect(actions).not.toContain('rpcProps')
})

// `RegionTooLargeMixin`'s gate is a byte axis, and the byte estimate comes from
// a feature adapter's index. An LD record source serves no features, so the
// gate could only ever return "unmeasurable" — a verdict of no verdict.
//
// This display used to opt IN and rely on that: it measured the genotype
// adapter it was about to read, and skipped the pre-computed ones, so the
// answer arrived as undefined and the byte axis dropped out on its own. With
// nothing but pre-computed adapters left there is no measurable case, and the
// honest answer is to decline the gate rather than to keep asking a question
// with one possible answer. What this pins is that the banner and the
// force-load control stay off a display where neither can act.
test('the byte gate is declined, so the banner never stands', () => {
  const { display, view } = createTestEnvironment().createDisplay()

  expect(display.gateEnabled).toBe(false)
  expect(display.regionTooLarge).toBe(false)

  view.zoomTo(100)
  expect(view.visibleBp).toBeGreaterThan(20_000)
  expect(display.regionTooLarge).toBe(false)
})
