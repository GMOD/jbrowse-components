import { saveAs } from 'file-saver'
import { getSession, assembleLocString } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { AbstractViewModel } from '@jbrowse/core/util/types'

// locals
import { GridBookmarkModel } from './model'
import { NavigableViewModel, LabeledRegion } from './types'

type LGV = LinearGenomeViewModel

export async function navToBookmark(
  locString: string,
  views: AbstractViewModel[],
  model: GridBookmarkModel,
) {
  const session = getSession(model)
  try {
    const { selectedAssembly } = model
    const lgv = views.find(
      view =>
        view.type === 'LinearGenomeView' &&
        // @ts-ignore
        view.assemblyNames[0] === selectedAssembly,
    ) as NavigableViewModel

    if (lgv) {
      await lgv.navToLocString(locString)
    } else {
      const { assemblyManager } = session
      const assembly = await assemblyManager.waitForAssembly(selectedAssembly)
      if (assembly) {
        const view = session.addView('LinearGenomeView', {
          displayName: selectedAssembly,
        }) as LGV

        await view.navToLocString(locString)
      } else {
        throw new Error('assembly not found')
      }
    }
  } catch (e) {
    console.error(e)
    session.notify(`${e}`, 'error')
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
      const labelVal = label === '' ? '.' : label
      const locString = assembleLocString(b)

      if (fileFormat === 'BED') {
        if (b.assemblyName === selectedAssembly || selectedAssembly === 'all') {
          return `${b.refName}\t${b.start}\t${b.end}\t${labelVal}\n`
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
