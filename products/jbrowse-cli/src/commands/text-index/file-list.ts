import path from 'node:path'

import {
  formatDryRun,
  prepareIndexDriverFlags,
  sanitizeNameForPath,
} from './config-utils.ts'
import { indexDriver, prepareFileTrackConfigs } from './indexing-utils.ts'
import { validateFileInput } from './validators.ts'

import type { TextIndexFlags } from './index.ts'

export async function indexFileList(flags: TextIndexFlags): Promise<void> {
  const {
    out,
    target,
    fileId,
    file,
    attributes,
    quiet,
    exclude,
    include,
    prefixSize,
    dryrun,
  } = flags
  validateFileInput(file)
  // --out/--target names either the install directory or its config.json, as
  // every other command accepts; the trix output goes beside the config, and
  // pointing at the config.json used to mkdir config.json/trix and fail ENOTDIR
  const outArg = target || out || '.'
  const outLocation = outArg.endsWith('.json') ? path.dirname(outArg) : outArg

  const trackConfigs = prepareFileTrackConfigs(file, fileId)

  if (dryrun) {
    console.log(formatDryRun(trackConfigs))
  } else {
    const name =
      trackConfigs.length > 1
        ? 'aggregate'
        : sanitizeNameForPath(path.basename(file[0]!))

    await indexDriver({
      trackConfigs,
      outLocation,
      name,
      assemblyNames: [],
      ...prepareIndexDriverFlags({
        attributes,
        exclude,
        include,
        quiet,
        prefixSize,
      }),
    })

    console.log(
      'Successfully created index for these files. See https://jbrowse.org/storybook/lgv/with-aggregate-text-searching/ for info about usage',
    )
  }
}
