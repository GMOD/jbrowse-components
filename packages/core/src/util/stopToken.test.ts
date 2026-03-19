import {
  checkStopToken,
  checkStopToken2,
  createStopToken,
  createStopTokenChecker,
  stopStopToken,
} from './stopToken'

// SAB is available in Node.js, so we can test the full atomic path.
// The XHR path requires a web worker and is not testable in Jest.

describe('stopToken', () => {
  describe('SharedArrayBuffer path', () => {
    function createSABToken() {
      const buffer = new SharedArrayBuffer(4)
      new Int32Array(buffer)[0] = 0
      return buffer
    }

    it('checkStopToken does not throw for an active token', () => {
      const token = createSABToken()
      expect(() => checkStopToken(token)).not.toThrow()
    })

    it('checkStopToken throws after stopStopToken', () => {
      const token = createSABToken()
      stopStopToken(token)
      expect(() => checkStopToken(token)).toThrow('aborted')
    })

    it('checkStopToken is a no-op for undefined', () => {
      expect(() => checkStopToken(undefined)).not.toThrow()
    })

    it('stopStopToken is a no-op for undefined', () => {
      expect(() => stopStopToken(undefined)).not.toThrow()
    })
  })

  describe('string fallback path', () => {
    it('checkStopToken does not throw in non-worker env', () => {
      expect(() => checkStopToken('some-string-token')).not.toThrow()
    })
  })

  describe('createStopToken', () => {
    it('returns a token', () => {
      const token = createStopToken()
      expect(token).toBeDefined()
    })
  })

  describe('createStopTokenChecker', () => {
    it('sets sabView for SAB tokens', () => {
      const buffer = new SharedArrayBuffer(4)
      new Int32Array(buffer)[0] = 0
      const checker = createStopTokenChecker(buffer)
      expect(checker.sabView).toBeInstanceOf(Int32Array)
      expect(checker.checkIters).toBe(10)
    })

    it('leaves sabView undefined for string tokens', () => {
      const checker = createStopTokenChecker('blob:test')
      expect(checker.sabView).toBeUndefined()
      expect(checker.checkIters).toBe(100)
    })

    it('handles undefined token', () => {
      const checker = createStopTokenChecker(undefined)
      expect(checker.stopToken).toBeUndefined()
      expect(checker.sabView).toBeUndefined()
    })
  })

  describe('checkStopToken2', () => {
    it('is a no-op when checker is undefined', () => {
      expect(() => checkStopToken2(undefined)).not.toThrow()
    })

    it('is a no-op when stopToken is undefined', () => {
      const checker = createStopTokenChecker(undefined)
      for (let i = 0; i < 200; i++) {
        checkStopToken2(checker)
      }
      // iters not incremented when stopToken is undefined (early return)
      expect(checker.iters).toBe(0)
    })

    it('increments iters on every call', () => {
      const buffer = new SharedArrayBuffer(4)
      new Int32Array(buffer)[0] = 0
      const checker = createStopTokenChecker(buffer)
      checkStopToken2(checker)
      checkStopToken2(checker)
      checkStopToken2(checker)
      expect(checker.iters).toBe(3)
    })

    describe('SAB throttling', () => {
      it('does not throw before checkIters reached', () => {
        const buffer = new SharedArrayBuffer(4)
        const view = new Int32Array(buffer)
        view[0] = 0
        const checker = createStopTokenChecker(buffer)
        expect(checker.checkIters).toBe(10)

        // Stop the token — but checks should be skipped until iter 10
        Atomics.store(view, 0, 1)

        for (let i = 0; i < 9; i++) {
          expect(() => checkStopToken2(checker)).not.toThrow()
        }
        // 10th call hits the check
        expect(() => checkStopToken2(checker)).toThrow('aborted')
      })

      it('does not throw when token is active at check boundary', () => {
        const buffer = new SharedArrayBuffer(4)
        new Int32Array(buffer)[0] = 0
        const checker = createStopTokenChecker(buffer)

        for (let i = 0; i < 30; i++) {
          expect(() => checkStopToken2(checker)).not.toThrow()
        }
      })

      it('throws on next check boundary after stop', () => {
        const buffer = new SharedArrayBuffer(4)
        const view = new Int32Array(buffer)
        view[0] = 0
        const checker = createStopTokenChecker(buffer)

        // Run past first check boundary without stopping
        for (let i = 0; i < 15; i++) {
          checkStopToken2(checker)
        }

        // Stop the token
        Atomics.store(view, 0, 1)

        // Run until the next check boundary (iter 20)
        for (let i = 0; i < 4; i++) {
          expect(() => checkStopToken2(checker)).not.toThrow()
        }
        // iter 20 should throw
        expect(() => checkStopToken2(checker)).toThrow('aborted')
      })
    })

    describe('XHR throttling', () => {
      it('respects checkIters gate for string tokens', () => {
        const checker = createStopTokenChecker('blob:test')
        expect(checker.checkIters).toBe(100)

        // In Jest (not a web worker), checkStopToken is a no-op for strings,
        // so we just verify the iteration counting works
        for (let i = 0; i < 200; i++) {
          checkStopToken2(checker)
        }
        expect(checker.iters).toBe(200)
      })

      it('applies linear backoff to checkInterval', () => {
        const checker = createStopTokenChecker('blob:test')
        const initial = checker.checkInterval
        expect(initial).toBe(50)

        // Force past the iteration gate and time gate by backdating
        checker.iters = 99
        checker.time = 0
        checkStopToken2(checker)

        // In Jest the XHR check is a no-op, but backoff should still apply
        // (checkStopToken doesn't throw in non-worker, so backoff executes)
        expect(checker.checkInterval).toBe(initial + 50)
      })
    })
  })
})
