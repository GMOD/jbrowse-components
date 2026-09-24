import { reactionDependencies } from '@jbrowse/render-core/namedReactions'
import { autorun, getAtom, spy } from 'mobx'

export interface CensusStep {
  name: string
  run: () => unknown
}

/** One cell per step: `take` answers what was counted since the last take. */
export interface CensusColumn {
  take: () => string
  reset: () => void
  stop: () => void
}

type Derivation = (this: unknown) => unknown

interface Computed {
  derivation: Derivation
}

// `derivation` is the body a ComputedValue runs on each recompute, and the one
// member MobX keeps unminified for MST. Wrapping it counts recomputes, not
// reads, and leaves the model as written.
function wrapDerivation(
  node: object,
  key: string,
  wrap: (original: Derivation) => Derivation,
) {
  const computed = getAtom(node, key) as unknown as Partial<Computed>
  const original = computed.derivation
  if (typeof original !== 'function') {
    throw new Error(`${key} is not a computed member of this node`)
  }
  computed.derivation = wrap(original)
  return () => {
    computed.derivation = original
  }
}

/** Recomputes of the computed `key` on `node`. */
export function recomputeColumn(
  node: object,
  key: string,
  label = key,
): CensusColumn {
  let runs = 0
  const stop = wrapDerivation(
    node,
    key,
    original =>
      function (this: unknown) {
        runs += 1
        return original.call(this)
      },
  )
  return {
    take: () => {
      const cell = `${label} ${runs}`
      runs = 0
      return cell
    },
    reset: () => {
      runs = 0
    },
    stop,
  }
}

/**
 * Arranger runs and the rows they were handed: `editableSources` is the
 * mixin's one `arrangeRows` call, so its recomputes are the arranger's runs.
 */
function arrangeColumn(display: object): CensusColumn {
  let runs = 0
  let rows = 0
  const stop = wrapDerivation(
    display,
    'editableSources',
    original =>
      function (this: unknown) {
        const out = original.call(this) as readonly unknown[]
        runs += 1
        rows += out.length
        return out
      },
  )
  return {
    take: () => {
      const cell = `arrange ${runs}${runs ? ` (${rows} rows)` : ''}`
      runs = 0
      rows = 0
      return cell
    },
    reset: () => {
      runs = 0
      rows = 0
    },
    stop,
  }
}

type RowAlias = (name: string) => string | undefined

/**
 * Calls into the display's `rowAlias`, from the arranger, the focus and the
 * dialog alike: each alias the getter computes is handed out wrapped, one
 * wrapper per alias so its identity still moves only when the alias does.
 */
function aliasColumn(display: { rowAlias?: unknown }): CensusColumn {
  let calls = 0
  const wrappers = new WeakMap<RowAlias, RowAlias>()
  const counted = new WeakSet<RowAlias>()
  const stop = wrapDerivation(
    display,
    'rowAlias',
    original =>
      function (this: unknown) {
        const alias = original.call(this)
        if (typeof alias !== 'function') {
          return alias
        }
        const own = alias as RowAlias
        let wrapped = wrappers.get(own)
        if (!wrapped) {
          wrapped = name => {
            calls += 1
            return own(name)
          }
          wrappers.set(own, wrapped)
          counted.add(wrapped)
        }
        return wrapped
      },
  )
  return {
    take: () => {
      const current = display.rowAlias
      if (typeof current === 'function' && !counted.has(current as RowAlias)) {
        throw new Error(
          'rowAlias still hands out the alias it held before the census, so its calls went uncounted; start the census before the rows land',
        )
      }
      const cell = `alias ${calls}`
      calls = 0
      return cell
    },
    reset: () => {
      calls = 0
    },
    stop,
  }
}

/**
 * Runs of the named reactions (`namedAutorun`) recorded on any of `owners`,
 * by name. Other reactions — the view's, React's, the census's own — are left
 * out.
 */
export function reactionColumn(owners: readonly object[]): CensusColumn {
  const runs = new Map<string, number>()
  const owned = new Map<string, boolean>()
  const owns = (name: string) => {
    let answer = owned.get(name)
    if (answer === undefined) {
      answer = owners.some(owner => {
        try {
          reactionDependencies(owner, name)
          return true
        } catch {
          return false
        }
      })
      owned.set(name, answer)
    }
    return answer
  }
  const stop = spy(event => {
    if (event.type === 'reaction' && owns(event.name)) {
      runs.set(event.name, (runs.get(event.name) ?? 0) + 1)
    }
  })
  return {
    take: () => {
      const cell =
        [...runs]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, n]) => `${name} ${n}`)
          .join(', ') || '-'
      runs.clear()
      return cell
    },
    reset: () => {
      runs.clear()
    },
    stop,
  }
}

const SETTLE_MS = 1000

async function settleTimers() {
  await jest.advanceTimersByTimeAsync(SETTLE_MS)
}

function table(lines: string[][]) {
  const widths = lines[0]!.map((_, i) =>
    Math.max(...lines.map(line => line[i]!.length)),
  )
  return lines
    .map(line =>
      line
        .map((cell, i) => cell.padEnd(widths[i]!))
        .join('  ')
        .trimEnd(),
    )
    .join('\n')
}

/**
 * Runs `steps` in order, letting the fake clock run out each one's timers,
 * and answers a table with one line per step and one cell per column.
 */
export async function runCensus(
  steps: readonly CensusStep[],
  columns: readonly CensusColumn[],
  settle: () => Promise<void> = settleTimers,
) {
  try {
    for (const column of columns) {
      column.reset()
    }
    const lines: string[][] = []
    for (const step of steps) {
      await step.run()
      await settle()
      lines.push([step.name, ...columns.map(column => column.take())])
    }
    return table(lines)
  } finally {
    for (const column of columns) {
      column.stop()
    }
  }
}

const ROW_GETTERS = ['clusterableSources', 'sources', 'rowColorScale'] as const

/**
 * The work a `TreeSidebarMixin` display does per step, counted: arranger runs
 * and the rows handed to them, calls into `rowAlias`, recomputes of the row
 * getters after `editableSources`, and runs of the display's named reactions.
 *
 * The getters are held observed through the census, as the mounted sidebar
 * and labels hold them, so a count is a recompute rather than a read. Start it
 * before the rows land: an alias computed and held before the census is not
 * wrapped, and a step ending with one in force throws rather than miss its
 * calls.
 */
export async function workCensus(
  display: object,
  steps: readonly CensusStep[],
  { settle }: { settle?: () => Promise<void> } = {},
) {
  const getters = ROW_GETTERS.filter(key => key in display)
  const columns = [
    arrangeColumn(display),
    aliasColumn(display),
    ...getters.map(key =>
      recomputeColumn(display, key, key.replace(/Sources$/, '')),
    ),
    reactionColumn([display]),
  ]
  const held = display as Record<string, unknown>
  const observe = autorun(
    () => {
      for (const key of ['editableSources', ...getters]) {
        void held[key]
      }
    },
    { name: 'workCensus' },
  )
  try {
    return await runCensus(steps, columns, settle)
  } finally {
    observe()
  }
}
