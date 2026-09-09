import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'

export interface WiggleAdapterOptions extends BaseOptions {
  resolution?: number
  // The feature field `featuresToRaw` plots for an adapter with no array fast
  // path; the fast paths serve `score` and ignore it
  scoreField?: string
}
