import { saveAs } from 'file-saver'
import { getSession, assembleLocString } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { AbstractViewModel } from '@jbrowse/core/util/types'

// locals
import { GridBookmarkModel } from './model'

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
      const viewsOfSelectedAssembly: AbstractViewModel[] = []
      views.forEach(element => {
        if (
          element.type === 'LinearGenomeView' &&
          // @ts-expect-error
          element.assemblyNames[0] === assembly
        ) {
          viewsOfSelectedAssembly.push(element)
        }
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
  fileFormat: string,
  model: GridBookmarkModel,
) {
  const { selectedBookmarks, bookmarksWithValidAssemblies } = model
  const bookmarksToDownload =
    selectedBookmarks.length === 0
      ? bookmarksWithValidAssemblies
      : selectedBookmarks

  if (fileFormat === 'BED') {
    const fileHeader = ''
    const fileContents: Record<string, string[]> = {}
    bookmarksToDownload.forEach(bookmark => {
      const { label } = bookmark
      const labelVal = label === '' ? '.' : label
      const line = `${bookmark.refName}\t${bookmark.start}\t${bookmark.end}\t${labelVal}\n`

      fileContents[bookmark.assemblyName]
        ? fileContents[bookmark.assemblyName].push(line)
        : (fileContents[bookmark.assemblyName] = [line])
    })

    for (const assembly in fileContents) {
      const fileContent = fileContents[assembly].reduce(
        (a, b) => a + b,
        fileHeader,
      )
      const blob = new Blob([fileContent || ''], {
        type: 'text/x-bed;charset=utf-8',
      })
      const fileName = `jbrowse_bookmarks_${assembly}.bed`
      saveAs(blob, fileName)
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

    const blob = new Blob([fileContents || ''], {
      type: 'text/tab-separated-values;charset=utf-8',
    })
    const fileName = 'jbrowse_bookmarks.tsv'
    saveAs(blob, fileName)
  }
}

/**
 * Compress and encode a string as url-safe base64
 * See {@link https://en.wikipedia.org/wiki/Base64#URL_applications}
 * @param str-  a string to compress and encode
 */
export async function toUrlSafeB64(str: string) {
  const bytes = new TextEncoder().encode(str)
  const { deflate } = await import('pako')
  const { fromByteArray } = await import('base64-js')
  const deflated = deflate(bytes)
  const encoded = fromByteArray(deflated)
  const pos = encoded.indexOf('=')
  return pos > 0
    ? encoded.slice(0, pos).replaceAll('+', '-').replaceAll('/', '_')
    : encoded.replaceAll('+', '-').replaceAll('/', '_')
}
