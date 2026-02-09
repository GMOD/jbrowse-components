// Simplified and inlined from https://github.com/sindresorhus/p-limit (v7)
//
// MIT License
// Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

interface QueueItem {
  run: () => void
}

export interface LimitFunction {
  <T>(fn: () => Promise<T> | T): Promise<T>
  activeCount: number
  pendingCount: number
  clearQueue: () => void
}

export default function pLimit(concurrency: number): LimitFunction {
  if (
    !(
      (Number.isInteger(concurrency) ||
        concurrency === Number.POSITIVE_INFINITY) &&
      concurrency > 0
    )
  ) {
    throw new TypeError('Expected `concurrency` to be a number from 1 and up')
  }

  const queue: QueueItem[] = []
  let activeCount = 0

  const resumeNext = () => {
    if (activeCount < concurrency && queue.length > 0) {
      activeCount++
      queue.shift()!.run()
    }
  }

  const next = () => {
    activeCount--
    resumeNext()
  }

  const run = async <T>(
    fn: () => Promise<T> | T,
    resolve: (value: Promise<T>) => void,
  ) => {
    const result = (async () => fn())()
    resolve(result)
    try {
      await result
    } catch {}
    next()
  }

  const enqueue = <T>(
    fn: () => Promise<T> | T,
    resolve: (value: Promise<T>) => void,
  ) => {
    const queueItem = {} as QueueItem
    new Promise<void>(internalResolve => {
      queueItem.run = internalResolve
      queue.push(queueItem)
    }).then(() => run(fn, resolve))

    if (activeCount < concurrency) {
      resumeNext()
    }
  }

  const generator = <T>(fn: () => Promise<T> | T) =>
    new Promise<T>(resolve => {
      enqueue(fn, resolve as (value: Promise<T>) => void)
    })

  Object.defineProperties(generator, {
    activeCount: {
      get: () => activeCount,
    },
    pendingCount: {
      get: () => queue.length,
    },
    clearQueue: {
      value() {
        queue.length = 0
      },
    },
  })

  return generator as LimitFunction
}
