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
    // get the focused view
    let view = views.find(view => view === session.focusedView) as MaybeLGV

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
      // if 1+ instances open, that is the view to nav to
      if (viewsOfSelectedAssembly.length >= 1) {
        view = viewsOfSelectedAssembly[0] as LGV
      }
    }

    // if no view is opened of the selectedAssembly, open a new view with that assembly
    if (!view) {
      const newViewId = `${model.id}_${assembly}`
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
