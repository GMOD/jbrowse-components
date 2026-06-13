import { extractWithComment, getAllFiles } from './util.ts'
import {
  accumulateApi,
  writeApiDocs,
  writeApiReadmes,
} from './generateApiDocs.ts'
import { writeColorDocs } from './generateColorDocs.ts'
import { accumulateConfig, writeConfigDocs } from './generateConfigDocs.ts'
import { accumulateModel, writeModelDocs } from './generateStateModelDocs.ts'

import type { ApiGroup } from './generateApiDocs.ts'
import type { Config } from './generateConfigDocs.ts'
import type { StateModel } from './generateStateModelDocs.ts'

// Build the TypeScript program over the whole repo ONCE and route each tagged
// node into the config, state-model, and API accumulators. Previously the
// generators ran as separate processes, each paying that whole-repo program load
// (the dominant cost); doing it once amortizes it across all of them.
async function main() {
  const configs: Record<string, Config> = {}
  const models: Record<string, StateModel> = {}
  const api: Record<string, ApiGroup> = {}
  extractWithComment(await getAllFiles(), obj => {
    accumulateConfig(configs, obj)
    accumulateModel(models, obj)
    accumulateApi(api, obj)
  })
  await writeConfigDocs(configs)
  await writeModelDocs(models)
  await writeApiDocs(api)
  await writeApiReadmes(api)
  writeColorDocs()
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main()
