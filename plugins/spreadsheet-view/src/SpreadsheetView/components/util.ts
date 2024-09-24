import { AbstractSessionModel, FileLocation } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel
type MaybeLGV = LinearGenomeViewModel | undefined

export function locationLinkClick({
  assemblyName,
  session,
  locString,
  spreadsheetViewId,
}: {
  assemblyName: string
  session: AbstractSessionModel
  locString: string
  spreadsheetViewId: string
}) {
  const newViewId = `${spreadsheetViewId}_${assemblyName}`
  let view = session.views.find(v => v.id === newViewId) as MaybeLGV
  if (!view) {
    view = session.addView('LinearGenomeView', { id: newViewId }) as LGV
  }
  return view.navToLocString(locString, assemblyName)
}

export const fileTypes = ['VCF', 'BED', 'BEDPE', 'STAR-Fusion']

export const fileTypesRegexp = new RegExp(
  `\\.(${fileTypes.join('|')})(\\.gz)?$`,
  'i',
)

export function getFilename(file?: FileLocation) {
  return file
    ? // @ts-expect-error
      file.uri ||
        // @ts-expect-error
        file.localPath ||
        // @ts-expect-error
        (file.blobId && file.name)
    : undefined
}

export function getFileType(file?: FileLocation) {
  const name = getFilename(file)

  if (name) {
    const firstMatch = fileTypesRegexp.exec(name)?.[1]
    if (firstMatch) {
      return firstMatch === 'tsv' && name.includes('star-fusion')
        ? 'STAR-Fusion'
        : firstMatch.toUpperCase()
    }
  }
  return 'VCF'
}
