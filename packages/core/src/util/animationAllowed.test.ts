import { animationAllowed } from './animationAllowed.ts'

// jsdom ships no `matchMedia` at all, so the OS half of this has to be stood up
// rather than steered. Only `matches` is ever read.
function withReducedMotion(reduce: boolean, run: () => void) {
  Object.defineProperty(globalThis, 'matchMedia', {
    value: () => ({ matches: reduce }),
    configurable: true,
  })
  try {
    run()
  } finally {
    Reflect.deleteProperty(globalThis, 'matchMedia')
  }
}

test('an explicit preference is honoured whatever the OS says', () => {
  for (const reduce of [true, false]) {
    withReducedMotion(reduce, () => {
      expect(animationAllowed('enabled')).toBe(true)
      expect(animationAllowed('disabled')).toBe(false)
    })
  }
})

// The whole point of the third mode: a reader who has told their OS they do not
// want motion gets none, without having had to find a JBrowse setting.
test('system defers to the OS reduced-motion setting', () => {
  withReducedMotion(true, () => {
    expect(animationAllowed('system')).toBe(false)
  })
  withReducedMotion(false, () => {
    expect(animationAllowed('system')).toBe(true)
  })
})

// An OS with nothing to say — and every environment with no `matchMedia` at all
// — is not an OS asking for less motion.
test('system animates where the preference cannot be asked', () => {
  expect(typeof matchMedia).toBe('undefined')
  expect(animationAllowed('system')).toBe(true)
})

// A worker, an SSR pass, a node RPC context: nothing here can play a frame, and
// the answer has to be no rather than a scheduling call that throws.
test('an environment with no frame clock animates nothing', () => {
  const real = globalThis.requestAnimationFrame
  Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
  try {
    expect(animationAllowed('enabled')).toBe(false)
  } finally {
    globalThis.requestAnimationFrame = real
  }
})
