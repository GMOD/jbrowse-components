import { buildEnumConstantIndex } from './enumConstants.ts'
import { formatDocs } from './format.ts'
import {
  accumulateApi,
  writeApiDocs,
  writeApiReadmes,
} from './generateApiDocs.ts'
import { writeColorDocs } from './generateColorDocs.ts'
import { accumulateConfig, writeConfigDocs } from './generateConfigDocs.ts'
import { writeDisplayFoundationDocs } from './generateDisplayFoundationDocs.ts'
import { writeExtensionPointDocs } from './generateExtensionPointDocs.ts'
import {
  writeDisplayTypeDocs,
  writeFileTypeDocs,
  writeGotchaDocs,
} from './generateFileTypeDocs.ts'
import { writeJexlDocs } from './generateJexlDocs.ts'
import { accumulateModel, writeModelDocs } from './generateStateModelDocs.ts'
import { extractWithComment, getAllFiles, listDocs } from './util.ts'

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
  // enum tables first: the config generator resolves `[...NAME]` spreads in
  // stringEnum models against this while rendering slots
  buildEnumConstantIndex(files)
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
  writeDisplayFoundationDocs()
  writeFileTypeDocs(files)
  writeDisplayTypeDocs(displayTypesByTrack, configNames)
  writeGotchaDocs(
    new Map(
      Object.values(configs)
        .filter(c => c.header?.gotchas.length)
        .map(c => [c.header!.name, c.header!.gotchas]),
    ),
  )

  await formatOutput()
}

// Directories `pnpm gendocs` is responsible for leaving format-clean: the
// generated pages, plus the hand-written guides whose marker blocks were
// rewritten above (FILE_TYPES, DISPLAY_TYPES, GOTCHA, COLOR_TABLE,
// EXTENSION_POINTS_INDEX). The tables are prettier-ignored, but the gotcha
// callouts are prose and must be rewrapped or every regen would fight
// `pnpm format`.
const FORMAT_DIRS = [
  'website/docs/config',
  'website/docs/models',
  'website/docs/api',
  'website/docs/config_guides',
  'website/docs/developer_guides',
]

// Formatting a page is not a fixed point in one pass: writeFormatted runs
// prettier over the assembled markdown, but reflowing an embedded code fence
// can change what the next pass does to it (an arrow-function parameter list
// that fit on one line no longer does once the fence is re-indented), so a
// single pass could still leave output `prettier --check` rejects. Re-run until
// nothing changes. The cap keeps a genuinely unstable file from spinning
// forever — it surfaces as a `pnpm format` failure instead.
//
// This used to shell out to the `prettier` binary, which resolves only when the
// PATH an npm script sets is in play: running `node docs/generate.ts` directly
// spawned ENOENT and silently formatted nothing, since a failed spawn reports
// no status. Going through the API removes that whole failure mode.
async function formatOutput() {
  for (let pass = 0; pass < 3; pass++) {
    const changed = await formatDocs(FORMAT_DIRS.flatMap(dir => listDocs(dir)))
    if (!changed) {
      return
    }
  }
  console.warn(
    'generated docs did not reach a stable prettier formatting after 3 passes',
  )
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main()
