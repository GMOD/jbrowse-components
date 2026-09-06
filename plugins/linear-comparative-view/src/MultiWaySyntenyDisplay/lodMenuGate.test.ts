import { createDisplayWithSession } from './testEnv.ts'

// `trackHasLodTiers` reads the THRESHOLD SLOT, which MultiPairwiseSyntenyAdapter
// declares whether or not its children carry a coarse tier, so the hg38
// vertebrates star — five headerless liftOver PIFs — offered a Level of detail
// entry that switched nothing. The header's `hasCoarseTier` is what says
// whether there is a second tier to reach; the slot stays the threshold.

const menuLabels = (
  display: ReturnType<typeof createDisplayWithSession>['display'],
) => display.trackMenuItems().map(i => ('label' in i ? i.label : undefined))

function tieredDisplay() {
  return createDisplayWithSession({
    syntenyAdapter: { type: 'PairwiseIndexedPAFAdapter' },
  }).display
}

test('the menu is offered on a tiered adapter until its header says otherwise', () => {
  const display = tieredDisplay()
  expect(display.hasLodCapableAdapter).toBe(true)
  expect(menuLabels(display)).toContain('Level of detail')

  display.setLodTierInfo({ hasCoarseTier: true, coarseGap: 10000 })
  expect(menuLabels(display)).toContain('Level of detail')
})

test('a header with no coarse tier withdraws the menu and keeps the slot as the threshold', () => {
  const display = tieredDisplay()
  display.setLodTierInfo({ hasCoarseTier: false })
  expect(menuLabels(display)).not.toContain('Level of detail')
  expect(display.hasLodCapableAdapter).toBe(true)

  display.setLodMode('coarse')
  expect(display.lodTier).toBe('fine')
})

test('the untiered default mode is untouched by the gate', () => {
  const display = tieredDisplay()
  display.setLodTierInfo({ hasCoarseTier: false })
  expect(display.lodMode).toBe('auto')
})
