import { isAbortException } from './aborting.ts'
import {
  checkStopTokenThrottled,
  checkStopToken,
  createStopToken,
  createStopTokenChecker,
  hasSharedArrayBuffer,
  isStopped,
  markStopTokenStopped,
  registerStopTokenBroadcaster,
  stopStopToken,
  stopTokenSignal,
  withStopTokenSignal,
} from './stopToken.ts'

// SAB is CONSTRUCTIBLE in Node.js, so both paths are fully testable here: the
// atomic flag by naming a buffer directly, and the message path because it asks
// nothing of the environment (a stopped id is recorded in this same module
// instance). Naming the buffer is also what keeps those tests honest now that
// `createStopToken()` answers with the string every deployment gets — the SAB
// path is exercised on purpose rather than by accident of the realm.

describe('stopToken', () => {
  describe('SharedArrayBuffer path', () => {
    function createSABToken() {
      const buffer = new SharedArrayBuffer(4)
      new Int32Array(buffer)[0] = 0
      return buffer
    }

    it('checkStopToken does not throw for an active token', () => {
      const token = createSABToken()
      expect(() => {
        checkStopToken(token)
      }).not.toThrow()
    })

    it('checkStopToken throws after stopStopToken', () => {
      const token = createSABToken()
      stopStopToken(token)
      expect(() => {
        checkStopToken(token)
      }).toThrow('aborted')
    })

    it('checkStopToken is a no-op for undefined', () => {
      expect(() => {
        checkStopToken(undefined)
      }).not.toThrow()
    })

    it('stopStopToken is a no-op for undefined', () => {
      expect(() => {
        stopStopToken(undefined)
      }).not.toThrow()
    })
  })

  describe('string token path', () => {
    it('checkStopToken does not throw for a token never stopped', () => {
      expect(() => {
        checkStopToken('never-stopped-token')
      }).not.toThrow()
    })

    // The message path: stopStopToken records the id locally, which is all a
    // main-thread RPC needs (same module instance) and what a worker's
    // RpcServer reproduces via markStopTokenStopped.
    it('checkStopToken throws after stopStopToken, by set lookup alone', () => {
      const token = 'stopped-locally'
      stopStopToken(token)
      expect(() => {
        checkStopToken(token)
      }).toThrow('aborted')
    })

    it('markStopTokenStopped is what a worker applies on the posted id', () => {
      const token = 'stopped-by-message'
      expect(isStopped(token)).toBe(false)
      markStopTokenStopped(token)
      expect(isStopped(token)).toBe(true)
    })

    it('broadcasts a stopped id to registered transports', () => {
      const seen: string[] = []
      const unregister = registerStopTokenBroadcaster(id => {
        seen.push(id)
      })
      try {
        stopStopToken('broadcast-me')
        expect(seen).toEqual(['broadcast-me'])
      } finally {
        unregister()
      }
      stopStopToken('after-unregister')
      expect(seen).toEqual(['broadcast-me'])
    })

    // One token is stopped two or three times over — the fetch's `finally`, the
    // rotation superseding it, and `cancel` — and each repeat used to fan a
    // message out to every worker in the pool for a token they had all been
    // told about already.
    it('broadcasts once however many times the same id is stopped', () => {
      const seen: string[] = []
      const unregister = registerStopTokenBroadcaster(id => {
        seen.push(id)
      })
      try {
        stopStopToken('stopped-thrice')
        stopStopToken('stopped-thrice')
        stopStopToken('stopped-thrice')
        expect(seen).toEqual(['stopped-thrice'])
      } finally {
        unregister()
      }
    })

    it('does not broadcast SAB tokens, which carry their own flag', () => {
      const seen: string[] = []
      const unregister = registerStopTokenBroadcaster(id => {
        seen.push(id)
      })
      try {
        stopStopToken(new SharedArrayBuffer(4))
        expect(seen).toEqual([])
      } finally {
        unregister()
      }
    })
  })

  describe('isStopped', () => {
    it('is false for undefined', () => {
      expect(isStopped(undefined)).toBe(false)
    })

    it('tracks the atomic flag for SAB tokens', () => {
      const token = new SharedArrayBuffer(4)
      expect(isStopped(token)).toBe(false)
      stopStopToken(token)
      expect(isStopped(token)).toBe(true)
    })
  })

  describe('stopTokenSignal', () => {
    it('gives an unaborted signal for a live token', () => {
      const { signal, dispose } = stopTokenSignal('signal-live')
      expect(signal.aborted).toBe(false)
      dispose()
    })

    it('aborts when the token is stopped', () => {
      const token = 'signal-stopped-later'
      const { signal, dispose } = stopTokenSignal(token)
      expect(signal.aborted).toBe(false)
      stopStopToken(token)
      expect(signal.aborted).toBe(true)
      expect(isAbortException(signal.reason)).toBe(true)
      dispose()
    })

    it('aborts immediately for an already-stopped token', () => {
      const token = 'signal-stopped-first'
      stopStopToken(token)
      expect(stopTokenSignal(token).signal.aborted).toBe(true)
    })

    it('aborts every signal taken against one token', () => {
      const token = 'signal-shared'
      const a = stopTokenSignal(token)
      const b = stopTokenSignal(token)
      stopStopToken(token)
      expect([a.signal.aborted, b.signal.aborted]).toEqual([true, true])
    })

    it('dispose detaches, so a later stop leaves the signal alone', () => {
      const token = 'signal-disposed'
      const { signal, dispose } = stopTokenSignal(token)
      dispose()
      stopStopToken(token)
      expect(signal.aborted).toBe(false)
    })

    it('is inert for an undefined token', () => {
      const { signal, dispose } = stopTokenSignal(undefined)
      expect(signal.aborted).toBe(false)
      dispose()
    })

    it('aborts on a SAB token via waitAsync', async () => {
      const token = new SharedArrayBuffer(4)
      const { signal } = stopTokenSignal(token)
      expect(signal.aborted).toBe(false)
      // waitAsync resolves off the Atomics.notify in stopStopToken, but not
      // within the same turn — measured to land after a setTimeout(0), so wait
      // on the abort event rather than a sleep that would encode that timing.
      const aborted = new Promise<void>(resolve => {
        signal.addEventListener('abort', () => {
          resolve()
        })
      })
      stopStopToken(token)
      await aborted
      expect(signal.aborted).toBe(true)
    })
  })

  describe('withStopTokenSignal', () => {
    it('gives fn a live signal and releases it on success', async () => {
      const token = 'with-signal-success'
      const captured = await withStopTokenSignal(token, async signal => {
        expect(signal.aborted).toBe(false)
        return signal
      })
      // released, so a later stop no longer reaches it
      stopStopToken(token)
      expect(captured.aborted).toBe(false)
    })

    it('releases the signal when fn throws', async () => {
      const token = 'with-signal-throw'
      let captured: AbortSignal | undefined
      await expect(
        withStopTokenSignal(token, async signal => {
          captured = signal
          throw new Error('read failed')
        }),
      ).rejects.toThrow('read failed')
      stopStopToken(token)
      expect(captured?.aborted).toBe(false)
    })

    it('aborts the signal while fn is still running', async () => {
      const token = 'with-signal-inflight'
      const seen = await withStopTokenSignal(token, async signal => {
        stopStopToken(token)
        return signal.aborted
      })
      expect(seen).toBe(true)
    })
  })

  describe('createStopToken', () => {
    it('returns a token', () => {
      const token = createStopToken()
      expect(token).toBeDefined()
    })

    // The deployment path, and the reason it is asserted rather than assumed:
    // this realm CAN construct a SharedArrayBuffer, and until the gate asked
    // about cross-origin isolation instead, that alone was enough to hand every
    // test a token no browser deployment ever gets. The two paths do not check
    // at the same moments, so a suite on the wrong one is a suite that cannot
    // see a whole class of cancellation bug.
    // TWO TESTS, because one cannot see it: the id has to be unique across the
    // whole module instance, and `stoppedIds` is module-global while
    // `config/jest/deterministicIds.js` resets its counter PRNG before every
    // test. So the id `nanoid()` draws is the same one in both halves below,
    // and without a per-realm sequence the second token is born stopped.
    it('stops one token', () => {
      const token = createStopToken()
      stopStopToken(token)
      expect(isStopped(token)).toBe(true)
    })

    it('and the next token is live, though the RNG repeats', () => {
      expect(isStopped(createStopToken())).toBe(false)
    })

    it('is a string wherever the page is not cross-origin isolated', () => {
      expect(globalThis.crossOriginIsolated).not.toBe(true)
      expect(typeof createStopToken()).toBe('string')
      expect(hasSharedArrayBuffer).toBe(false)
    })
  })

  describe('createStopTokenChecker', () => {
    it('sets sabView for SAB tokens', () => {
      const buffer = new SharedArrayBuffer(4)
      new Int32Array(buffer)[0] = 0
      const checker = createStopTokenChecker(buffer)
      expect(checker.sabView).toBeInstanceOf(Int32Array)
      expect(checker.iters).toBe(0)
    })

    it('leaves sabView undefined for string tokens', () => {
      const checker = createStopTokenChecker('some-token')
      expect(checker.sabView).toBeUndefined()
      expect(checker.checkInterval).toBe(50)
    })

    it('handles undefined token', () => {
      const checker = createStopTokenChecker(undefined)
      expect(checker.stopToken).toBeUndefined()
      expect(checker.sabView).toBeUndefined()
    })
  })

  describe('checkStopTokenThrottled', () => {
    it('is a no-op when checker is undefined', () => {
      expect(() => {
        checkStopTokenThrottled(undefined)
      }).not.toThrow()
    })

    it('is a no-op when stopToken is undefined', () => {
      const checker = createStopTokenChecker(undefined)
      for (let i = 0; i < 200; i++) {
        checkStopTokenThrottled(checker)
      }
      // iters not incremented when stopToken is undefined (early return)
      expect(checker.iters).toBe(0)
    })

    it('increments iters on every call of the SAB path', () => {
      const buffer = new SharedArrayBuffer(4)
      new Int32Array(buffer)[0] = 0
      const checker = createStopTokenChecker(buffer)
      checkStopTokenThrottled(checker)
      checkStopTokenThrottled(checker)
      checkStopTokenThrottled(checker)
      expect(checker.iters).toBe(3)
    })

    describe('SAB throttling', () => {
      it('does not throw before the iteration mask is reached', () => {
        const buffer = new SharedArrayBuffer(4)
        const view = new Int32Array(buffer)
        view[0] = 0
        const checker = createStopTokenChecker(buffer)

        // Stop the token — but checks should be skipped until iter 10
        Atomics.store(view, 0, 1)

        for (let i = 0; i < 9; i++) {
          expect(() => {
            checkStopTokenThrottled(checker)
          }).not.toThrow()
        }
        // 10th call hits the check
        expect(() => {
          checkStopTokenThrottled(checker)
        }).toThrow('aborted')
      })

      it('does not throw when token is active at check boundary', () => {
        const buffer = new SharedArrayBuffer(4)
        new Int32Array(buffer)[0] = 0
        const checker = createStopTokenChecker(buffer)

        for (let i = 0; i < 30; i++) {
          expect(() => {
            checkStopTokenThrottled(checker)
          }).not.toThrow()
        }
      })

      it('throws on next check boundary after stop', () => {
        const buffer = new SharedArrayBuffer(4)
        const view = new Int32Array(buffer)
        view[0] = 0
        const checker = createStopTokenChecker(buffer)

        // Run past first check boundary without stopping
        for (let i = 0; i < 15; i++) {
          checkStopTokenThrottled(checker)
        }

        // Stop the token
        Atomics.store(view, 0, 1)

        // Run until the next check boundary (iter 20)
        for (let i = 0; i < 4; i++) {
          expect(() => {
            checkStopTokenThrottled(checker)
          }).not.toThrow()
        }
        // iter 20 should throw
        expect(() => {
          checkStopTokenThrottled(checker)
        }).toThrow('aborted')
      })
    })

    // These exist because deleting the synchronous probe outright once passed
    // every other test in the repo: jsdom is not a worker global, so the
    // production probe is inert here and its absence is invisible. They assert
    // the *seam* is consulted rather than the XHR itself.
    describe('synchronous probe (the only path that interrupts an await-free loop)', () => {
      it('installs a probe on every string-token checker', () => {
        // the deletion guard: a checker with no probe cannot interrupt a loop
        // that never yields, whatever else still works
        expect(typeof createStopTokenChecker('blob:x').syncProbe).toBe(
          'function',
        )
      })

      it('throws when the probe reports stopped, with no message delivered', () => {
        const checker = createStopTokenChecker('blob:never-broadcast')
        checker.syncProbe = () => true
        // nothing called stopStopToken, so stoppedIds cannot know — this models
        // a worker mid-loop, which no postMessage can reach
        expect(isStopped('blob:never-broadcast')).toBe(false)
        expect(() => {
          checkStopTokenThrottled(checker)
        }).toThrow('aborted')
      })

      it('interrupts a long-running loop that never awaits', () => {
        // The shape of getLDMatrix's O(n^2) fill: no await, so a synchronous read
        // is the only way out. The clock advances 1ms per iteration because the
        // gate is wall-clock based — a 100k-iteration loop that really finishes
        // inside one 50ms window gets a single check, correctly, and would make
        // this assert nothing.
        let now = 1_000_000
        const spy = jest.spyOn(Date, 'now').mockImplementation(() => now)
        try {
          const checker = createStopTokenChecker('blob:await-free-loop')
          // cancelled 200ms into the work, as a user clicking cancel would
          checker.syncProbe = () => now - 1_000_000 > 200
          let ran = 0
          expect(() => {
            for (let i = 0; i < 100_000; i++) {
              now++
              ran++
              checkStopTokenThrottled(checker)
            }
          }).toThrow('aborted')
          // interrupted rather than run to completion, and promptly: the gate's
          // backoff caps at 500ms, so detection lands well inside a second
          expect(ran).toBeLessThan(1000)
        } finally {
          spy.mockRestore()
        }
      })

      it('is consulted only when the time gate is open', () => {
        let probes = 0
        const spy = jest.spyOn(Date, 'now').mockImplementation(() => 1_000_000)
        try {
          const checker = createStopTokenChecker('blob:gated')
          checker.syncProbe = () => {
            probes++
            return false
          }
          for (let i = 0; i < 1000; i++) {
            checkStopTokenThrottled(checker)
          }
          // clock frozen, so after the gate's first fire nothing more is due
          expect(probes).toBe(1)
        } finally {
          spy.mockRestore()
        }
      })

      it('the real probe is inert outside a worker rather than aborting', () => {
        // guards the isWebWorker/blob: guard: a probe that answered "stopped"
        // for an unprobeable token would abort every loop on its first check
        const token = 'blob:not-a-worker'
        const checker = createStopTokenChecker(token)
        expect(() => {
          for (let i = 0; i < 100; i++) {
            checkStopTokenThrottled(checker)
          }
        }).not.toThrow()
      })
    })

    describe('string token throttling (time-gated, not iteration-gated)', () => {
      // The counter belongs to the SAB path's iteration mask; nothing on the
      // string path reads it, so it deliberately stays at 0 here rather than
      // being bumped per item for no reader.
      it('leaves iters alone for string tokens', () => {
        const checker = createStopTokenChecker('some-token')
        for (let i = 0; i < 200; i++) {
          checkStopTokenThrottled(checker)
        }
        expect(checker.iters).toBe(0)
      })

      it('does not throw for a live token however many times it is called', () => {
        const checker = createStopTokenChecker('live-in-loop')
        expect(() => {
          for (let i = 0; i < 500; i++) {
            checkStopTokenThrottled(checker)
          }
        }).not.toThrow()
      })

      it('throws on a low-iteration call when the time gate is open', () => {
        // Regression for the low-count freeze: a fixed iteration mask could
        // starve the check on a loop with few but heavy iterations, making it
        // uncancellable. One call, then 200ms of per-item work, then a call that
        // must notice — with only two iterations elapsed.
        let now = 1_000_000
        const spy = jest.spyOn(Date, 'now').mockImplementation(() => now)
        try {
          const token = 'stopped-mid-loop'
          const checker = createStopTokenChecker(token)
          checkStopTokenThrottled(checker)
          stopStopToken(token)
          now += 200
          expect(() => {
            checkStopTokenThrottled(checker)
          }).toThrow('aborted')
        } finally {
          spy.mockRestore()
        }
      })
    })
  })
})
