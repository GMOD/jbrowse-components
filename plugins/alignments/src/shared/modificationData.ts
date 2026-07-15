import type { CytosineContext } from '@jbrowse/modifications-utils'

export interface ModificationData {
  color: string
  name: string
}

// Cytosine contexts offered wherever methylation is colored (the fill-unmarked
// view and bisulfite). CpG is the default; CHG/CHH cover plant methylation.
export const cytosineContextOptions: {
  value: CytosineContext
  label: string
}[] = [
  { value: 'CG', label: 'CpG' },
  { value: 'CHG', label: 'CHG' },
  { value: 'CHH', label: 'CHH' },
  { value: 'all', label: 'All cytosines' },
]

// Adapted from IGV
// https://github.com/igvteam/igv/blob/af07c3b1be8806cfd77343ee04982aeff17d2beb/src/main/resources/org/broad/igv/prefs/preferences.tab#L230-L242
export const modificationData: Record<string, ModificationData> = {
  m: { color: 'rgb(255,0,0)', name: '5mC' },
  h: { color: 'rgb(255,0,255)', name: '5hmC' },
  o: { color: 'rgb(111, 78, 129)', name: '8oxoG' },
  f: { color: 'rgb(246, 200, 95)', name: '5fC' },
  c: { color: 'rgb(157, 216, 102)', name: '5cac' },
  g: { color: 'rgb(255, 160, 86)', name: '5hmu' },
  e: { color: 'rgb(141, 221, 208)', name: '5fU' },
  b: { color: 'rgb(0,100,47)', name: '5caU' },
  a: { color: 'rgb(51,0,111)', name: '6mA' },
  17082: { color: 'rgb(51,153,255)', name: 'pseU' },
  17596: { color: 'rgb(102,153,0)', name: 'inosine' },
  21839: { color: 'rgb(153,0,153)', name: '4mC' },
}

export function getModificationName(type: string): string {
  return modificationData[type]?.name || type
}
