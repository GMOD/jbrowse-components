import path from 'path'

import {
  ensureTrixDir,
  prepareIndexDriverFlags,
  sanitizeNameForPath,
} from './config-utils'
import { indexDriver, prepareFileTrackConfigs } from './indexing-utils'
import { validateFileInput } from './validators'

import type { TextIndexFlags } from './index'

export async function indexFileList(flags: TextIndexFlags): Promise<void> {
  const { out, target, fileId, file, attributes, quiet, exclude, prefixSize } =
    flags
  validateFileInput(file)
  const outFlag = target || out || '.'
  ensureTrixDir(outFlag)

  const trackConfigs = prepareFileTrackConfigs(file!, fileId)

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
    'Successfully created index for these files. See https://jbrowse.org/storybook/lgv/main/?path=/story/text-searching--page for info about usage',
  )
}
