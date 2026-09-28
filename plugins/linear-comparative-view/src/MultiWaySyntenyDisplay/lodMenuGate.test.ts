import { createDisplayWithSession } from './testEnv.ts'

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

  display.setAdapterHeader({
    adapterConfig: display.adapterConfig,
    value: { hasCoarseTier: true, coarseGap: 10000 },
  })
  expect(menuLabels(display)).toContain('Level of detail')
})

test('a header with no coarse tier withdraws the menu and keeps the slot as the threshold', () => {
  const display = tieredDisplay()
  display.setAdapterHeader({
    adapterConfig: display.adapterConfig,
    value: { hasCoarseTier: false },
  })
  expect(menuLabels(display)).not.toContain('Level of detail')
  expect(display.hasLodCapableAdapter).toBe(true)

  display.setLodMode('coarse')
  expect(display.lodTier).toBe('fine')
})

test('the untiered default mode is untouched by the gate', () => {
  const display = tieredDisplay()
  display.setAdapterHeader({
    adapterConfig: display.adapterConfig,
    value: { hasCoarseTier: false },
  })
  expect(display.lodMode).toBe('auto')
})
