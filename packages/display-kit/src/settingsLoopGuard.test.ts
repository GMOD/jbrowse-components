/**
 * The dev-only guard on the `SettingsInvalidate` autorun.
 *
 * Its whole job is diagnostic: the rpcProps() feedback loop otherwise surfaces
 * as MobX's "Reaction doesn't converge", which names neither the autorun nor
 * the fetch-derived value that caused it. It also breaks the loop, by throwing
 * before the `clearAllRpcData()` that perpetuates it.
 *
 * A guard like this fails silently in both directions and nothing else notices.
 * Too eager a reset and the counter never reaches the threshold, so the day
 * someone writes the loop they get the cryptic error the guard exists to
 * replace. Too lazy a reset and a display that legitimately invalidates often
 * throws at a user. Neither shows up in any other test, because in every other
 * test the guard is simply never called twice.
 */
import { makeSettingsLoopGuard } from './displayAutoruns.ts'

test('a runaway synchronous loop throws, naming the autorun and the cause', () => {
  const guard = makeSettingsLoopGuard('SettingsInvalidate')
  expect(() => {
    for (let i = 0; i < 60; i++) {
      guard()
    }
  }).toThrow(/SettingsInvalidate re-fired/)
})

// The message is the entire point of the guard, so assert it still says what to
// do rather than only that it threw.
test('the message names rpcProps and where to read about it', () => {
  const guard = makeSettingsLoopGuard('SettingsInvalidate')
  let thrown: unknown
  try {
    for (let i = 0; i < 60; i++) {
      guard()
    }
  } catch (e) {
    thrown = e
  }
  const message = `${thrown}`
  expect(message).toMatch(/a fetch-derived value is almost certainly in/)
  expect(message).toMatch(
    /rpcProps\(\) must read only user-controlled settings/,
  )
  expect(message).toMatch(/ARCHITECTURE\.md/)
})

// 50 is chosen to land inside MobX's own 100-iteration convergence guard, so
// this one throws first and the cryptic one never surfaces. Raising the
// threshold past 100 would silently give the loop back to MobX.
test('the threshold is under MobX 100-iteration convergence limit', () => {
  const guard = makeSettingsLoopGuard('SettingsInvalidate')
  for (let i = 0; i < 50; i++) {
    guard()
  }
  expect(() => {
    guard()
  }).toThrow()
})

// The counter is per synchronous tick, not cumulative: a display whose settings
// genuinely change many times over a session invalidates far more than 50 times
// in total, and must never throw for it. The reset is a queueMicrotask, so
// awaiting one microtask turn is enough to observe it — no timers.
test('the same number of fires spread across ticks never throws', async () => {
  const guard = makeSettingsLoopGuard('SettingsInvalidate')
  for (let tick = 0; tick < 20; tick++) {
    for (let i = 0; i < 50; i++) {
      guard()
    }
    // the reset was queued on the first call of this tick, so it runs ahead of
    // this continuation
    await Promise.resolve()
  }
  // 1000 fires, none of them a loop
  expect(() => {
    guard()
  }).not.toThrow()
})

// Each display composes its own guard, so one display's invalidation storm must
// not push another over the edge.
test('two guards count independently', () => {
  const a = makeSettingsLoopGuard('A')
  const b = makeSettingsLoopGuard('B')
  for (let i = 0; i < 50; i++) {
    a()
  }
  expect(() => {
    b()
  }).not.toThrow()
  expect(() => {
    a()
  }).toThrow(/^A re-fired/)
})
