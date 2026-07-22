import { sync as spawnSync } from 'cross-spawn'

import {
  accumulateApi,
  writeApiDocs,
  writeApiReadmes,
} from './generateApiDocs.ts'
import { writeColorDocs } from './generateColorDocs.ts'
import { accumulateConfig, writeConfigDocs } from './generateConfigDocs.ts'
import { writeExtensionPointDocs } from './generateExtensionPointDocs.ts'
import {
  writeDisplayTypeDocs,
  writeFileTypeDocs,
  writeGotchaDocs,
} from './generateFileTypeDocs.ts'
import { writeJexlDocs } from './generateJexlDocs.ts'
import { accumulateModel, writeModelDocs } from './generateStateModelDocs.ts'
import { extractWithComment, getAllFiles } from './util.ts'

import type { ApiGroup } from './generateApiDocs.ts'
import type { Config } from './generateConfigDocs.ts'
import type { StateModel } from './generateStateModelDocs.ts'
import type { DisplayTrackLink } from './util.ts'

// Build the TypeScript program over the whole repo ONCE and route each tagged
// node into the config, state-model, and API accumulators. Previously the
// generators ran as separate processes, each paying that whole-repo program load
// (the dominant cost); doing it once amortizes it across all of them.
async function main() {
  const configs: Record<string, Config> = {}
  const models: Record<string, StateModel> = {}
  const api: Record<string, ApiGroup> = {}
  const displayLinks: DisplayTrackLink[] = []
  const files = await getAllFiles()
  extractWithComment(
    files,
    obj => {
      accumulateConfig(configs, obj)
      accumulateModel(models, obj)
      accumulateApi(api, obj)
    },
    link => displayLinks.push(link),
  )

  // Reverse index: a Track config's "Display types" section looks up displays
  // by the track's own name, the only end of this link a Track's source code
  // doesn't itself carry. displayToTrackType is the forward direction, so a
  // display page can find the adapters that feed its track type.
  const displayTypesByTrack = new Map<string, string[]>()
  const displayToTrackType = new Map<string, string>()
  for (const { displayName, trackType } of displayLinks) {
    const displayNames = displayTypesByTrack.get(trackType)
    if (displayNames) {
      // extractWithComment can emit the same link twice (the VariableStatement
      // and its inner declaration), so guard against a duplicate display bullet
      if (!displayNames.includes(displayName)) {
        displayNames.push(displayName)
      }
    } else {
      displayTypesByTrack.set(trackType, [displayName])
    }
    displayToTrackType.set(displayName, trackType)
  }
  const modelNames = new Set(
    Object.values(models)
      .map(m => m.header?.name)
      .filter((name): name is string => Boolean(name)),
  )
  const configNames = new Set(
    Object.values(configs)
      .map(c => c.header?.name)
      .filter((name): name is string => Boolean(name)),
  )

  await writeConfigDocs(
    configs,
    displayTypesByTrack,
    displayToTrackType,
    modelNames,
  )
  await writeModelDocs(models, configNames)
  await writeApiDocs(api)
  await writeApiReadmes(api)
  writeColorDocs()
  writeJexlDocs()
  writeExtensionPointDocs()
  writeFileTypeDocs(files)
  writeDisplayTypeDocs(displayTypesByTrack, configNames)
  writeGotchaDocs(
    new Map(
      Object.values(configs)
        .filter(c => c.header?.gotchas.length)
        .map(c => [c.header!.name, c.header!.gotchas]),
    ),
  )

  // writeFormatted's programmatic prettier.format() call on embedded markdown
  // code fences isn't always a fixed point of the prettier CLI (e.g. arrow
  // function param lists can break differently). Run the CLI once over the
  // whole output so it matches what `pnpm prettier --check` expects.
  spawnSync(
    'prettier',
    [
      '--write',
      'website/docs/config',
      'website/docs/models',
      'website/docs/api',
      // the marker blocks written into the hand-written guides above
      // (FILE_TYPES, DISPLAY_TYPES, GOTCHA) land here unformatted; the tables
      // are prettier-ignored but the gotcha callouts are prose and must be
      // rewrapped, or every regen would fight `pnpm format`
      'website/docs/config_guides',
    ],
    { stdio: 'inherit' },
  )
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main()
