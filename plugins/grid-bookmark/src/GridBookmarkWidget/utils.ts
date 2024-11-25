import { getSession, assembleLocString } from '@jbrowse/core/util'
import { saveAs } from 'file-saver'
import type { GridBookmarkModel } from './model'
import type { AbstractViewModel } from '@jbrowse/core/util/types'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals

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

      if (fileContents[bookmark.assemblyName]) {
        fileContents[bookmark.assemblyName]!.push(line)
      } else {
        fileContents[bookmark.assemblyName] = [line]
      }
    })

    for (const assembly in fileContents) {
      const fileContent = fileContents[assembly]!.reduce(
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
 * Pad the end of a base64 string with "=" to make it valid
 * @param b64 - unpadded b64 string
 */
export function b64PadSuffix(b64: string): string {
  let num = 0
  const mo = b64.length % 4
  switch (mo) {
    case 3:
      num = 1
      break
    case 2:
      num = 2
      break
    case 0:
      num = 0
      break
    default:
      throw new Error('base64 not a valid length')
  }
  return b64 + '='.repeat(num)
}

/**
 * Decode and inflate a url-safe base64 to a string
 * See {@link https://en.wikipedia.org/wiki/Base64#URL_applications}
 * @param b64 - a base64 string to decode and inflate
 */
export async function fromUrlSafeB64(b64: string) {
  const originalB64 = b64PadSuffix(
    b64.replaceAll('-', '+').replaceAll('_', '/'),
  )
  const { toByteArray } = await import('base64-js')
  const { inflate } = await import('pako')
  const bytes = toByteArray(originalB64)
  const inflated = inflate(bytes)
  return new TextDecoder().decode(inflated)
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
