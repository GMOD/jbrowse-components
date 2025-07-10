import fs from 'fs'
import path from 'path'

import { indexDriver, prepareFileTrackConfigs } from './indexing-utils'
import { validateFileInput } from './validators'

export async function indexFileList(flags: any) {
  const { out, target, fileId, file, attributes, quiet, exclude, prefixSize } =
    flags
  validateFileInput(file)
  const outFlag = target || out || '.'
  const trixDir = path.join(outFlag, 'trix')
  if (!fs.existsSync(trixDir)) {
    fs.mkdirSync(trixDir)
  }

  const trackConfigs = prepareFileTrackConfigs(file, fileId)

  await indexDriver({
    trackConfigs,
    outLocation: outFlag,
    name: trackConfigs.length > 1 ? 'aggregate' : path.basename(file[0]),
    quiet,
    attributes: attributes.split(','),
    typesToExclude: exclude.split(','),
    assemblyNames: [],
    prefixSize,
  })

  console.log(
    'Successfully created index for these files. See https://jbrowse.org/storybook/lgv/main/?path=/story/text-searching--page for info about usage',
  )
}
