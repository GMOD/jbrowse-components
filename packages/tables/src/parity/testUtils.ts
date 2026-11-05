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

export interface ParityCase<C, K extends string> {
  name: string
  config: C
  /**
   * The decisions known to disagree, each with a pointer to the area that
   * owns it. They run as `test.failing`, so a fix turns them red until the
   * entry goes.
   */
  drifts?: Partial<Record<K, string>>
}

/**
 * A `describe` per case, standing up the model and the export once, and a
 * test per decision asserting the export's equals the view's.
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
        const check = () => {
          expect(decided).toBeDefined()
          expect(decided?.exported[key]).toEqual(decided?.view[key])
        }
        if (drift) {
          test.failing(`${key} (drift: ${drift})`, check)
        } else {
          test(key, check)
        }
      }
    })
  }
}
