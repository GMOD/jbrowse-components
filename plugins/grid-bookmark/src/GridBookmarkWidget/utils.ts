import { saveAs } from 'file-saver'

import {
  getSession,
  parseLocString,
  when,
  assembleLocString,
} from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { AbstractViewModel } from '@jbrowse/core/util/types'

import { GridBookmarkModel } from './model'
import { NavigableViewModel, LabeledRegion } from './types'

export async function navToBookmark(
  locString: string,
  views: AbstractViewModel[],
  model: GridBookmarkModel,
) {
  const { selectedAssembly } = model
  const lgv = views.find(
    view =>
      view.type === 'LinearGenomeView' &&
      // @ts-ignore
      view.assemblyNames[0] === selectedAssembly,
  ) as NavigableViewModel

  if (lgv) {
    lgv.navToLocString(locString)
  } else {
    const session = getSession(model)
    const { assemblyManager } = session
    const assembly = await assemblyManager.waitForAssembly(selectedAssembly)
    if (assembly) {
      try {
        const loc = parseLocString(locString, refName =>
          session.assemblyManager.isValidRefName(refName, selectedAssembly),
        )
        const { refName } = loc
        const { regions } = assembly
        const canonicalRefName = assembly.getCanonicalRefName(refName)

        let newDisplayedRegion
        if (regions) {
          newDisplayedRegion = regions.find(
            region => region.refName === canonicalRefName,
          )
        }

        const view = session.addView('LinearGenomeView', {
          displayName: selectedAssembly,
        }) as LinearGenomeViewModel
        await when(() => view.initialized)

        view.setDisplayedRegions([
          JSON.parse(JSON.stringify(newDisplayedRegion)),
        ])
        view.navToLocString(locString)
      } catch (e) {
        session.notify(`${e}`, 'error')
      }
    }
  }
}

export function downloadBookmarkFile(
  bookmarkedRegions: LabeledRegion[],
  fileFormat: string,
  model: GridBookmarkModel,
) {
  const { selectedAssembly } = model
  const fileHeader =
    fileFormat === 'TSV'
      ? 'chrom\tstart\tend\tlabel\tassembly_name\tcoord_range\n'
      : ''

  const fileContents = bookmarkedRegions
    .map(b => {
      const { label } = b
      const labelVal = label === '' ? 'NA' : label
      const locString = assembleLocString(b)

      if (fileFormat === 'BED') {
        if (b.assemblyName === selectedAssembly) {
          // the "name" column (column 4) in a BED has a max of 255 characters
          // according to the new spec: https://github.com/samtools/hts-specs/pull/570
          return `${b.refName}\t${b.start}\t${b.end}\t${labelVal.slice(
            0,
            255,
          )}\n`
        }
        return ''
      } else {
        return `${b.refName}\t${b.start + 1}\t${b.end}\t${labelVal}\t${
          b.assemblyName
        }\t${locString}\n`
      }
    })
    .reduce((a, b) => a + b, fileHeader)

  const blob = new Blob([fileContents || ''], {
    type:
      fileFormat === 'BED'
        ? 'text/x-bed;charset=utf-8'
        : 'text/tab-separated-values;charset=utf-8',
  })

  let fileName
  if (fileFormat === 'BED') {
    fileName = `jbrowse_bookmarks_${selectedAssembly}.bed`
  } else {
    fileName = 'jbrowse_bookmarks.tsv'
  }

  saveAs(blob, fileName)
}
