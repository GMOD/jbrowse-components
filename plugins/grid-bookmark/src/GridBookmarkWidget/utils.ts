import { saveAs } from 'file-saver'
import { getSession, assembleLocString } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { AbstractViewModel } from '@jbrowse/core/util/types'

// locals
import { GridBookmarkModel } from './model'
import { LabeledRegion } from './types'
import { getRoot } from 'mobx-state-tree'

type LGV = LinearGenomeViewModel

type MaybeLGV = LGV | undefined

export async function navToBookmark(
  locString: string,
  assembly: string,
  views: AbstractViewModel[],
  model: GridBookmarkModel,
) {
  const session = getSession(model)
  try {
    // search for exact match to an lgv that this bookmark widget launched, or
    // any lgv that looks like it is relevant to what we are browsing
    const newViewId = `${model.id}_${assembly}`

    // get the focused view
    let view = views.find(
      view => view.id === getSession(model).focusedViewId,
    ) as MaybeLGV

    // check if the focused view is the appropriate assembly, if not proceed
    if (!view || view?.assemblyNames[0] !== assembly) {
      // find number of instances open with the selectedAssembly
      let viewsOfSelectedAssembly: Array<AbstractViewModel> = []
      views.forEach(element => {
        if (
          element.type === 'LinearGenomeView' &&
          // @ts-expect-error
          element.assemblyNames[0] === assembly
        )
          viewsOfSelectedAssembly.push(element)
      })
      // if one instance open, that is the view to nav to
      if (viewsOfSelectedAssembly.length > 1) {
        view = viewsOfSelectedAssembly[0] as LGV
      } else {
        // what do we want to do if there are multiple views open of the same assembly none of which are in foucs?
      }
    }

    // if no view is opened of the selectedAssembly, open a new view with that assembly
    if (!view) {
      view = session.addView('LinearGenomeView', {
        id: newViewId,
      }) as LGV
    }
    await view.navToLocString(locString, assembly)
    session.notify('Navigated to the selected bookmark.', 'success')
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

  const fileName =
    fileFormat === 'BED'
      ? `jbrowse_bookmarks_${selectedAssembly}.bed`
      : 'jbrowse_bookmarks.tsv'

  saveAs(blob, fileName)
}
