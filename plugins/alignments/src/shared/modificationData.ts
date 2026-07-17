import type { CytosineContext } from '@jbrowse/modifications-utils'

export interface ModificationData {
  color: string
  name: string
  // Canonical base the modification sits on, per SAMtags — a 5mC is a modified
  // C. Lets the no-mod bucket be labeled "Unmodified C" from the type code
  // alone, without carrying a parallel per-call base array to the main thread.
  base: string
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
  m: { color: 'rgb(255,0,0)', name: '5mC', base: 'C' },
  h: { color: 'rgb(255,0,255)', name: '5hmC', base: 'C' },
  o: { color: 'rgb(111, 78, 129)', name: '8oxoG', base: 'G' },
  f: { color: 'rgb(246, 200, 95)', name: '5fC', base: 'C' },
  c: { color: 'rgb(157, 216, 102)', name: '5cac', base: 'C' },
  g: { color: 'rgb(255, 160, 86)', name: '5hmu', base: 'T' },
  e: { color: 'rgb(141, 221, 208)', name: '5fU', base: 'T' },
  b: { color: 'rgb(0,100,47)', name: '5caU', base: 'T' },
  a: { color: 'rgb(51,0,111)', name: '6mA', base: 'A' },
  17082: { color: 'rgb(51,153,255)', name: 'pseU', base: 'T' },
  17596: { color: 'rgb(102,153,0)', name: 'inosine', base: 'A' },
  21839: { color: 'rgb(153,0,153)', name: '4mC', base: 'C' },
}

export function getModificationName(type: string): string {
  return modificationData[type]?.name ?? type
}

// Display name for a single modification call. The no-mod bucket keeps the
// canonical mod code ('m'/'h') so its coverage denominator and simplex logic
// stay shared with the modified bucket, but it must never be labeled with that
// mod's name: its probability is the confidence the base is UNmodified. Every
// surface that names a call (read hover, feature widget, coverage tooltip) goes
// through here so the two can't drift — the hover tooltip used to read the mod
// name straight off the type code and labeled a blue unmodified mark "5mC".
export function getModificationCallName(type: string, noMod: boolean): string {
  const base = modificationData[type]?.base
  return noMod
    ? `Unmodified ${base ?? ''}`.trimEnd()
    : getModificationName(type)
}
