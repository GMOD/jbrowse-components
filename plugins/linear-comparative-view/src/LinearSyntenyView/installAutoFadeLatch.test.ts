import {
  FADE_AUTO_ENGAGE_PX,
  FADE_AUTO_RELEASE_PX,
} from '../LinearSyntenyDisplay/fadeThin.ts'
import { nextThinFadeLatch } from './installAutoFadeLatch.ts'

// `LinearSyntenyDisplay.wantsThinFade` with the feature-count gate satisfied:
// what the view asks each display, once per threshold.
const wants = (meanPx: number, thresholdPx: number) =>
  meanPx > 0 && meanPx < thresholdPx

function run(means: number[]) {
  let latch: boolean | undefined
  return means.map(mean => {
    latch = nextThinFadeLatch({
      previous: latch,
      engages: wants(mean, FADE_AUTO_ENGAGE_PX),
      holds: wants(mean, FADE_AUTO_RELEASE_PX),
    })
    return latch
  })
}

// The reason the latch exists. A pan re-fetches against a snapped window and the
// mean steps with the population it holds; a view sitting near the engage
// threshold used to flip the whole stack's alpha on every rollover.
test('a mean stepping across the engage threshold does not flicker', () => {
  expect(run([0.95, 1.05, 0.98, 1.2, 1.01])).toEqual([
    true,
    true,
    true,
    true,
    true,
  ])
})

test('a genuine zoom-in past the release width lets the fade go', () => {
  expect(run([0.5, 1.5])).toEqual([true, false])
})

test('and it does not re-engage until the ribbons are thin again', () => {
  expect(run([0.5, 3, 1.1, 0.9])).toEqual([true, false, false, true])
})

test('a sparse, wide view never engages it', () => {
  expect(run([4, 9, 40])).toEqual([false, false, false])
})
