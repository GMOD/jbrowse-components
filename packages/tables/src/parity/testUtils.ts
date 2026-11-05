/**
 * One display's side of the parity check: how to stand its model up over a
 * config and read the export for the same config, and the decisions both
 * make, each read off its own side.
 */
export interface ParityAdapter<C, M, E, K extends string> {
  decisionNames: readonly K[]
  buildModel: (config: C) => Promise<{ model: M; dispose: () => void }>
  buildExport: (config: C) => Promise<E>
  modelDecisions: (model: M) => Record<K, unknown>
  exportDecisions: (exported: E) => Record<K, unknown>
}

/**
 * A decision known to disagree: the area that owns it, and the value the
 * export decides today, which the view's differs from.
 */
export interface Drift {
  owner: string
  exported: unknown
}

export interface ParityCase<C, K extends string> {
  name: string
  config: C
  /**
   * The decisions known to disagree. Each asserts the export still decides
   * its pinned value and the view still decides another, so a fix or a
   * change in the wrong value fails until the entry is deleted or re-pinned.
   */
  drifts?: Partial<Record<K, Drift>>
}

function agrees(a: unknown, b: unknown) {
  try {
    expect(a).toEqual(b)
    return true
  } catch {
    return false
  }
}

function holdsDrift(
  key: string,
  { exported: pinned }: Drift,
  view: unknown,
  exported: unknown,
) {
  if (agrees(exported, view)) {
    throw new Error(
      `drift fixed: the export decides ${key} as the view does; delete this entry`,
    )
  } else if (!agrees(exported, pinned)) {
    throw new Error(
      `drift changed: the export decides ${key} as ${JSON.stringify(exported)}, not its pinned ${JSON.stringify(pinned)}; re-pin it if the view still differs`,
    )
  }
}

/**
 * A `describe` per case, standing up the model and the export once, and a
 * test per decision asserting the export's equals the view's, or for a
 * drift, that both still decide what the entry pins.
 */
export function parityCases<C, M, E, K extends string>(
  adapter: ParityAdapter<C, M, E, K>,
  cases: readonly ParityCase<C, K>[],
) {
  for (const { name, config, drifts } of cases) {
    describe(name, () => {
      let decided:
        | { view: Record<K, unknown>; exported: Record<K, unknown> }
        | undefined
      beforeAll(async () => {
        const { model, dispose } = await adapter.buildModel(config)
        try {
          decided = {
            view: adapter.modelDecisions(model),
            exported: adapter.exportDecisions(
              await adapter.buildExport(config),
            ),
          }
        } finally {
          dispose()
        }
      }, 60_000)
      for (const key of adapter.decisionNames) {
        const drift = drifts?.[key]
        if (drift) {
          test(`${key} (drift: ${drift.owner})`, () => {
            expect(decided).toBeDefined()
            holdsDrift(key, drift, decided?.view[key], decided?.exported[key])
          })
        } else {
          test(key, () => {
            expect(decided).toBeDefined()
            expect(decided?.exported[key]).toEqual(decided?.view[key])
          })
        }
      }
    })
  }
}
