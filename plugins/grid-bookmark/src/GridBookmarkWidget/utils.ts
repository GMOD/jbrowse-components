import {
  assembleLocString,
  getSession,
  measureGridWidth,
  measureText,
} from '@jbrowse/core/util'
import { isSameAssemblyName } from '@jbrowse/core/util/tracks'

import type { HighlightType } from '@jbrowse/core/util/highlights'
import type { AbstractViewModel } from '@jbrowse/core/util/types'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// DataGrid column width fitting the wider of the header text and the cell
// values. Capped at maxWidth so long values ellipsize (via the .cell style)
// instead of overflowing the narrow sidebar widget
export function colWidth(header: string, values: string[], maxWidth = 200) {
  return Math.min(
    Math.max(measureText(header, 12) + 30, measureGridWidth(values)),
    maxWidth,
  )
}

function isLinearGenomeView(
  v: AbstractViewModel,
): v is AbstractViewModel & LinearGenomeViewModel {
  return v.type === 'LinearGenomeView'
}

export async function navToHighlight(
  highlight: HighlightType,
  node: IStateTreeNode,
) {
  const session = getSession(node)
  const { assemblyName, ...region } = highlight
  const locString = assembleLocString(region)
  try {
    // prefer the focused view when it's an LGV on the right assembly, else the
    // first such LGV. a non-LGV (dotplot, circular) on this assembly has no
    // navToLocString
    const isTarget = (v: AbstractViewModel) =>
      isLinearGenomeView(v) &&
      isSameAssemblyName(
        v.assemblyNames[0],
        assemblyName,
        session.assemblyManager,
      )
    const view =
      session.views.find(v => v.id === session.focusedViewId && isTarget(v)) ??
      session.views.find(isTarget)

    // slightly zoom out (grow 0.2) so the region has context on either side
    if (view && isLinearGenomeView(view)) {
      await view.navToLocString(locString, assemblyName, 0.2)
    } else {
      // no view open for this assembly: launch a new one declaratively so it
      // shows a loading spinner (not a flash of the import form) while the
      // assembly loads, then self-navigates with the same grow
      session.addView('LinearGenomeView', {
        assembly: assemblyName,
        loc: locString,
        grow: 0.2,
      })
    }
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

// Parse imported highlight file contents. TSV files carry their own assembly
// column and 1-based starts (matching downloadHighlightFile's export); BED
// files are 0-based and adopt the assembly chosen in the dialog. Throws on
// malformed coordinates so the dialog surfaces the error instead of importing
// NaN regions.
export function parseHighlights(
  data: string,
  bedAssembly: string,
): HighlightType[] {
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
      label: !label || label === '.' ? undefined : label,
    }
  })
}

export async function downloadHighlightFile(
  fileFormat: string,
  highlights: readonly HighlightType[],
) {
  const { saveAs } = await import('@jbrowse/core/util/FileSaver')
  const labelOf = (h: HighlightType) => h.label || '.'

  if (fileFormat === 'BED') {
    const fileContents: Record<string, string[]> = {}
    for (const h of highlights) {
      const line = `${h.refName}\t${h.start}\t${h.end}\t${labelOf(h)}\n`
      ;(fileContents[h.assemblyName] ??= []).push(line)
    }

    for (const assembly in fileContents) {
      saveAs(
        new Blob([fileContents[assembly]!.join('')], {
          type: 'text/x-bed;charset=utf-8',
        }),
        `jbrowse_highlights_${assembly}.bed`,
      )
    }
  } else {
    const fileHeader = 'chrom\tstart\tend\tlabel\tassembly_name\tcoord_range\n'
    const fileContents =
      fileHeader +
      highlights
        .map(h => {
          const locString = assembleLocString(h)
          return `${h.refName}\t${h.start + 1}\t${h.end}\t${labelOf(h)}\t${h.assemblyName}\t${locString}\n`
        })
        .join('')

    saveAs(
      new Blob([fileContents], {
        type: 'text/tab-separated-values;charset=utf-8',
      }),
      'jbrowse_highlights.tsv',
    )
  }
}
