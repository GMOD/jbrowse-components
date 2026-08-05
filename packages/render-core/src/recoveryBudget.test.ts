import { RecoveryBudget } from './recoveryBudget.ts'

test('allows up to max recoveries, then gives up', () => {
  const budget = new RecoveryBudget(2, 60_000)
  expect(budget.record(0)).toBe('recover')
  expect(budget.record(100)).toBe('recover')
  expect(budget.record(200)).toBe('give-up')
})

test('attempt drives the backoff exponent', () => {
  const budget = new RecoveryBudget(2, 60_000)
  budget.record(0)
  expect(budget.attempt).toBe(1)
  budget.record(100)
  expect(budget.attempt).toBe(2)
})

test('a loss outside the window starts a fresh count', () => {
  const budget = new RecoveryBudget(2, 60_000)
  expect(budget.record(0)).toBe('recover')
  expect(budget.record(100)).toBe('recover')
  // The regression this class exists for: with a lifetime counter the next
  // loss is a give-up forever, so a session that loses its context twice in a
  // day can never auto-recover again.
  expect(budget.record(60_101)).toBe('recover')
  expect(budget.attempt).toBe(1)
})

test('a flap inside the window still climbs to the cap', () => {
  const budget = new RecoveryBudget(2, 60_000)
  // Re-losing a second after recovering is exactly what the cap is for, and
  // the window must not excuse it.
  expect(budget.record(0)).toBe('recover')
  expect(budget.record(1000)).toBe('recover')
  expect(budget.record(2000)).toBe('give-up')
})

test('reset returns a spent budget to a clean slate', () => {
  const budget = new RecoveryBudget(2, 60_000)
  budget.record(0)
  budget.record(100)
  expect(budget.record(200)).toBe('give-up')
  budget.reset()
  expect(budget.record(300)).toBe('recover')
  expect(budget.attempt).toBe(1)
})
