import {
  assembleLocString,
  getSession,
  measureGridWidth,
  measureText,
} from '@jbrowse/core/util'

import type { GridBookmarkModel } from './model.ts'
import type { AbstractViewModel } from '@jbrowse/core/util/types'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

type MaybeLGV = LGV | undefined

// stable identity for a bookmark/highlight region, used both to dedupe shared
// vs local bookmarks on load and to key overlay components (bookmarks have no
// id and can legitimately duplicate, so callers append an index to break ties)
export function bookmarkKey(r: {
  assemblyName?: string
  refName: string
  start: number
  end: number
}) {
  return `${r.assemblyName}_${r.refName}_${r.start}_${r.end}`
}

// DataGrid column width fitting the wider of the header text and the cell
// values, shared by the bookmark and highlight grids. Capped at maxWidth so
// long values ellipsize (via the .cell style) instead of overflowing the
// narrow sidebar widget
export function colWidth(header: string, values: string[], maxWidth = 200) {
  return Math.min(
    Math.max(measureText(header, 12) + 30, measureGridWidth(values)),
    maxWidth,
  )
}

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
          elt.type === 'LinearGenomeView' &&
          elt.assemblyNames?.[0] === assembly,
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
    // slightly zoom out so the bookmarked region has context on either side
    await view.navToLocString(locString, assembly, 0.2)
  } catch (e) {
    console.error(e)
    session.notifyError(`${e}`, e)
  }
}

// TSV carries its own assembly column plus a coord_range column; BED does not
function isTSVHeader(header: string) {
  return header.startsWith('chrom') && header.includes('assembly_name')
}

function parseCoord(value: string | undefined, field: string, line: string) {
  const n = Number(value)
  if (
    value === undefined ||
    value.trim() === '' ||
    !Number.isInteger(n) ||
    n < 0
  ) {
    throw new Error(`Invalid ${field} "${value ?? ''}" in line: ${line}`)
  }
  return n
}

// Parse imported bookmark file contents. TSV files carry their own assembly
// column and 1-based starts (matching downloadBookmarkFile's export); BED files
// are 0-based and adopt the assembly chosen in the dialog. Throws on malformed
// coordinates so the dialog surfaces the error instead of importing NaN regions.
export function parseBookmarks(data: string, bedAssembly: string) {
  const lines = data.split(/\n|\r\n|\r/).filter(f => !!f.trim())
  const tsv = lines.length > 0 && isTSVHeader(lines[0]!)
  const dataLines = (tsv ? lines.slice(1) : lines).filter(
    f => !f.startsWith('#'),
  )
  return dataLines.map(line => {
    const [refName, start, end, label, assemblyName] = line.split('\t')
    if (!refName) {
      throw new Error(`Missing refName in line: ${line}`)
    }
    return {
      assemblyName: tsv ? assemblyName || bedAssembly : bedAssembly,
      refName,
      // TSV starts are 1-based on export, so convert back to the 0-based
      // internal coordinate; BED starts are already 0-based
      start: parseCoord(start, 'start', line) - (tsv ? 1 : 0),
      end: parseCoord(end, 'end', line),
      label: label === '.' ? undefined : label,
    }
  })
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
    const fileContents: Record<string, string[]> = {}
    for (const bookmark of bookmarksToDownload) {
      const labelVal = bookmark.label === '' ? '.' : bookmark.label
      const line = `${bookmark.refName}\t${bookmark.start}\t${bookmark.end}\t${labelVal}\n`
      ;(fileContents[bookmark.assemblyName] ??= []).push(line)
    }

    for (const assembly in fileContents) {
      saveAs(
        new Blob([fileContents[assembly]!.join('')], {
          type: 'text/x-bed;charset=utf-8',
        }),
        `jbrowse_bookmarks_${assembly}.bed`,
      )
    }
  } else {
    // TSV
    const fileHeader = 'chrom\tstart\tend\tlabel\tassembly_name\tcoord_range\n'
    const fileContents =
      fileHeader +
      bookmarksToDownload
        .map(bookmark => {
          const labelVal = bookmark.label === '' ? '.' : bookmark.label
          const locString = assembleLocString(bookmark)
          return `${bookmark.refName}\t${bookmark.start + 1}\t${bookmark.end}\t${labelVal}\t${bookmark.assemblyName}\t${locString}\n`
        })
        .join('')

    saveAs(
      new Blob([fileContents], {
        type: 'text/tab-separated-values;charset=utf-8',
      }),
      'jbrowse_bookmarks.tsv',
    )
  }
}
