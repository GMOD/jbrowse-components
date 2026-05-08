import { assembleLocString, getSession } from '@jbrowse/core/util'

import type { GridBookmarkModel } from './model.ts'
import type { AbstractViewModel } from '@jbrowse/core/util/types'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
    let view = views.find(view => view.id === session.focusedViewId) as MaybeLGV

    // check if the focused view is the appropriate assembly, if not proceed
    if (view?.assemblyNames[0] !== assembly) {
      view = views.find(
        elt =>
          // @ts-expect-error
          elt.type === 'LinearGenomeView' && elt.assemblyNames[0] === assembly,
      ) as MaybeLGV
    }

    // if no view is opened of the selectedAssembly, open a new
    // view with that assembly
    if (!view) {
      const newViewId = `${model.id}_${assembly}`
      view = session.addView('LinearGenomeView', {
        id: newViewId,
      }) as LGV
    }
    await view.navToLocString(locString, assembly)
  } catch (e) {
    console.error(e)
    session.notifyError(`${e}`, e)
  }
}

export async function downloadBookmarkFile(
  fileFormat: string,
  model: GridBookmarkModel,
) {
  const { selectedBookmarks, bookmarksWithValidAssemblies } = model
  const bookmarksToDownload =
    selectedBookmarks.length === 0
      ? bookmarksWithValidAssemblies
      : selectedBookmarks

  const { saveAs } = await import('@jbrowse/core/util')

  if (fileFormat === 'BED') {
    const fileHeader = ''
    const fileContents: Record<string, string[]> = {}
    for (const bookmark of bookmarksToDownload) {
      const { label } = bookmark
      const labelVal = label === '' ? '.' : label
      const line = `${bookmark.refName}\t${bookmark.start}\t${bookmark.end}\t${labelVal}\n`

      if (fileContents[bookmark.assemblyName]) {
        fileContents[bookmark.assemblyName]!.push(line)
      } else {
        fileContents[bookmark.assemblyName] = [line]
      }
    }

    for (const assembly in fileContents) {
      const fileContent = fileContents[assembly]!.reduce(
        (a, b) => a + b,
        fileHeader,
      )

      saveAs(
        new Blob([fileContent || ''], {
          type: 'text/x-bed;charset=utf-8',
        }),
        `jbrowse_bookmarks_${assembly}.bed`,
      )
    }
  } else {
    // TSV
    const fileHeader = 'chrom\tstart\tend\tlabel\tassembly_name\tcoord_range\n'

    const fileContents = bookmarksToDownload
      .map(bookmark => {
        const { label } = bookmark
        const labelVal = label === '' ? '.' : label
        const locString = assembleLocString(bookmark)
        return `${bookmark.refName}\t${bookmark.start + 1}\t${
          bookmark.end
        }\t${labelVal}\t${bookmark.assemblyName}\t${locString}\n`
      })
      .reduce((a, b) => a + b, fileHeader)

    saveAs(
      new Blob([fileContents || ''], {
        type: 'text/tab-separated-values;charset=utf-8',
      }),
      'jbrowse_bookmarks.tsv',
    )
  }
}

export {
  b64PadSuffix,
  fromUrlSafeB64,
  toUrlSafeB64,
} from '@jbrowse/core/util'
