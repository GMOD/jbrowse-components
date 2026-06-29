import path from 'path'

import {
  ensureTrixDir,
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
    prefixSize,
    dryrun,
  } = flags
  validateFileInput(file)
  const outFlag = target || out || '.'

  const trackConfigs = prepareFileTrackConfigs(file!, fileId)

  if (dryrun) {
    console.log(
      trackConfigs.map(e => `${e.trackId}\t${e.adapter?.type}`).join('\n'),
    )
  } else {
    ensureTrixDir(outFlag)
    const name =
      trackConfigs.length > 1
        ? 'aggregate'
        : sanitizeNameForPath(path.basename(file![0]!))

    await indexDriver({
      trackConfigs,
      outLocation: outFlag,
      name,
      assemblyNames: [],
      ...prepareIndexDriverFlags({ attributes, exclude, quiet, prefixSize }),
    })

    console.log(
      'Successfully created index for these files. See https://jbrowse.org/storybook/lgv/with-aggregate-text-searching/ for info about usage',
    )
  }
}
