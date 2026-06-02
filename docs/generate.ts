import { extractWithComment, getAllFiles } from './util.ts'
import { accumulateConfig, writeConfigDocs } from './generateConfigDocs.ts'
import { accumulateModel, writeModelDocs } from './generateStateModelDocs.ts'

import type { Config } from './generateConfigDocs.ts'
import type { StateModel } from './generateStateModelDocs.ts'

// Build the TypeScript program over the whole repo ONCE and route each tagged
// node into both the config and state-model accumulators. Previously the two
// generators ran as separate processes, each paying that whole-repo program load
// (the dominant cost); doing it once halves it.
async function main() {
  const configs: Record<string, Config> = {}
  const models: Record<string, StateModel> = {}
  extractWithComment(await getAllFiles(), obj => {
    accumulateConfig(configs, obj)
    accumulateModel(models, obj)
  })
  writeConfigDocs(configs)
  writeModelDocs(models)
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main()
