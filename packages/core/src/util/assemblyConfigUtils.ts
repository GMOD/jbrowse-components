import { getFileName } from './getFileName.ts'
import { isLocalPathLocation, isUriLocation } from './types/data.ts'

import type { FileLocation } from './types/data.ts'

// Shared assembly "add sequence" form logic used by both the jbrowse-desktop
// Open genome(s) dialog and the in-app data-management Assembly manager. Pure
// (no React, no MST, no product wiring) so it can live in core and be reused by
// both surfaces. The one product-specific step — turning a plain FASTA into a
// usable adapter — is injected into buildAssemblyConf (desktop runs samtools
// faidx to produce an IndexedFastaAdapter; web keeps an UnindexedFastaAdapter).

export const adapterTypes = [
  'IndexedFastaAdapter',
  'BgzipFastaAdapter',
  'FastaAdapter',
  'TwoBitAdapter',
] as const

export type AdapterType = (typeof adapterTypes)[number]

export const adapterLabels: Record<AdapterType, string> = {
  IndexedFastaAdapter: 'FASTA with index (.fa + .fai)',
  BgzipFastaAdapter: 'Compressed FASTA (.fa.gz + .fai + .gzi)',
  FastaAdapter: 'FASTA (automatically indexed)',
  TwoBitAdapter: '2bit file (.2bit)',
}

export interface FormState {
  adapterSelection: AdapterType
  assemblyName: string
  assemblyDisplayName: string
  fastaLocation: FileLocation
  faiLocation: FileLocation
  gziLocation: FileLocation
  twoBitLocation: FileLocation
  chromSizesLocation: FileLocation
  refNameAliasesLocation: FileLocation
  cytobandsLocation: FileLocation
}

// The form fields that hold a file rather than text.
export type LocationField = {
  [K in keyof FormState]: FormState[K] extends FileLocation ? K : never
}[keyof FormState]

export const sidecarRoles = ['fai', 'gzi'] as const

export type SidecarRole = (typeof sidecarRoles)[number]

// What each index sidecar is called, where it lives on the form, and the
// extension it takes next to its sequence file.
export const sidecars = {
  fai: {
    field: 'faiLocation',
    ext: '.fai',
    label: 'FASTA index (.fai) file',
  },
  gzi: {
    field: 'gziLocation',
    ext: '.gzi',
    label: 'FASTA gzip index (.gzi) file',
  },
} as const satisfies Record<
  SidecarRole,
  { field: LocationField; ext: string; label: string }
>

// The sidecars each format cannot load without. One table because the same
// condition was written out at four sites and they drifted: the staging button
// gated on a copy that let a .fa.gz through with neither index, straight into
// getAdapterConfig's "FASTA, FAI, and GZI locations are all required".
const requiredSidecars: Record<AdapterType, SidecarRole[]> = {
  IndexedFastaAdapter: ['fai'],
  BgzipFastaAdapter: ['fai', 'gzi'],
  FastaAdapter: [],
  TwoBitAdapter: [],
}

// Curried field setter for the add-assembly form:
// makeSetField(setForm)('faiLocation') returns a value setter that merges just
// that field. Shared by AdvancedOptions and SequenceAdapterInputs so the
// immutable-update logic lives in one place.
export function makeSetField(
  setForm: (update: (prev: FormState) => FormState) => void,
) {
  return <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) => {
      setForm(f => ({ ...f, [key]: value }))
    }
}

const blank: FileLocation = { uri: '', locationType: 'UriLocation' }

export function initialFormState(): FormState {
  return {
    adapterSelection: adapterTypes[0],
    assemblyName: '',
    assemblyDisplayName: '',
    fastaLocation: blank,
    faiLocation: blank,
    gziLocation: blank,
    twoBitLocation: blank,
    chromSizesLocation: blank,
    refNameAliasesLocation: blank,
    cytobandsLocation: blank,
  }
}

export function applyPrimaryFile(
  state: FormState,
  location: FileLocation,
): FormState {
  const filename = getFileName(location)
  const detected = filename ? detectAdapterType(filename) : undefined
  const assemblyName =
    filename && !state.assemblyName
      ? getAssemblyNameFromFilename(filename)
      : state.assemblyName
  if (detected === 'TwoBitAdapter') {
    return {
      ...state,
      twoBitLocation: location,
      adapterSelection: 'TwoBitAdapter',
      assemblyName,
    }
  }
  const adapterSelection = detected ?? state.adapterSelection
  return {
    ...state,
    fastaLocation: location,
    adapterSelection,
    assemblyName,
    ...guessSidecarLocations(state, location, adapterSelection),
  }
}

// Prefill conventional .fai/.gzi sidecars sitting next to the chosen FASTA,
// leaving any field the user already set untouched. Spreading the source
// location carries over its baseUri/auth so the sidecars use the same access.
function guessSidecarLocations(
  state: FormState,
  location: FileLocation,
  adapterSelection: AdapterType,
): Partial<FormState> {
  const guesses: Partial<FormState> = {}
  for (const role of requiredSidecars[adapterSelection]) {
    const { field, ext } = sidecars[role]
    const guess = isBlank(state[field]) ? sidecar(location, ext) : undefined
    if (guess) {
      guesses[field] = guess
    }
  }
  return guesses
}

function sidecar(
  location: FileLocation,
  ext: string,
): FileLocation | undefined {
  if (isUriLocation(location)) {
    return { ...location, uri: `${location.uri}${ext}` }
  }
  if (isLocalPathLocation(location)) {
    return { ...location, localPath: `${location.localPath}${ext}` }
  }
  return undefined
}

export function applyTwoBitFile(
  state: FormState,
  location: FileLocation,
): FormState {
  const filename = getFileName(location)
  const assemblyName =
    filename && !state.assemblyName
      ? getAssemblyNameFromFilename(filename)
      : state.assemblyName
  return { ...state, twoBitLocation: location, assemblyName }
}

// Everything about the genome just staged, gone, so the next one starts clean.
// The chosen format survives on purpose: in the manual form it is what the user
// picked, and the guided path overwrites it from the next file set anyway.
export function clearFormFields(state: FormState): FormState {
  return { ...initialFormState(), adapterSelection: state.adapterSelection }
}

// Clear only the sequence-file fields (and their required index sidecars),
// keeping assembly-level metadata the user already entered — name, display name,
// refName aliases, cytobands. Used by the recognition card's "change" link so
// swapping a mis-picked sequence file doesn't discard everything else.
export function clearSequenceFiles(state: FormState): FormState {
  return {
    ...state,
    fastaLocation: blank,
    faiLocation: blank,
    gziLocation: blank,
    twoBitLocation: blank,
    chromSizesLocation: blank,
  }
}

export function getBaseAssemblyConfig(state: FormState) {
  return {
    name: state.assemblyName,
    ...(state.assemblyDisplayName
      ? { displayName: state.assemblyDisplayName }
      : {}),
    ...(!isBlank(state.refNameAliasesLocation)
      ? {
          refNameAliases: {
            adapter: {
              type: 'RefNameAliasAdapter',
              location: state.refNameAliasesLocation,
            },
          },
        }
      : {}),
    ...(!isBlank(state.cytobandsLocation)
      ? {
          cytobands: {
            adapter: {
              type: 'CytobandAdapter',
              cytobandLocation: state.cytobandsLocation,
            },
          },
        }
      : {}),
  }
}

export type AssemblyAdapter =
  | {
      type: 'IndexedFastaAdapter'
      fastaLocation: FileLocation
      faiLocation: FileLocation
    }
  | {
      type: 'BgzipFastaAdapter'
      fastaLocation: FileLocation
      faiLocation: FileLocation
      gziLocation: FileLocation
    }
  | {
      type: 'UnindexedFastaAdapter'
      fastaLocation: FileLocation
    }
  | {
      type: 'TwoBitAdapter'
      twoBitLocation: FileLocation
      // optional, and omitted rather than written blank: a 2bit carries its own
      // sequence names, and a blank UriLocation here is resolved like any other
      // relative location, which on desktop lands on the session file's own
      // directory and fails the assembly with `EISDIR`
      chromSizesLocation?: FileLocation
    }

export type AssemblyConf = ReturnType<typeof getBaseAssemblyConfig> & {
  sequence: {
    type: 'ReferenceSequenceTrack'
    trackId: string
    adapter: AssemblyAdapter
  }
}

export function isBlank(location: FileLocation) {
  return 'uri' in location && location.uri === ''
}

// The form can be opened only once its primary sequence file is chosen: the
// 2bit for TwoBitAdapter, otherwise the FASTA. Secondary files (.fai/.gzi) are
// validated later in getAdapterConfig.
export function formHasSequence(form: FormState) {
  return form.adapterSelection === 'TwoBitAdapter'
    ? !isBlank(form.twoBitLocation)
    : !isBlank(form.fastaLocation)
}

// The name the assembly is saved under. Trimmed because surrounding whitespace
// is never intentional and would otherwise create near-duplicate assemblies
// ("hg38" vs "hg38 ") that a caller's duplicate check can't catch.
export function getAssemblyName(form: FormState) {
  return form.assemblyName.trim()
}

// The index files the chosen format requires that the form doesn't have yet.
// getAdapterConfig throws on the same condition; asking first is what lets a
// caller disable its submit button instead of letting the user click it and
// read a stack trace back, and lets the pane offer an input for each one.
export function getMissingSidecars(form: FormState) {
  return requiredSidecars[form.adapterSelection]
    .map(role => sidecars[role])
    .filter(({ field }) => isBlank(form[field]))
}

// Whether the form can be submitted/staged: a primary sequence file, everything
// that file's format requires, and a (non-whitespace) name. Shared so every
// add-assembly surface gates its submit button the same way.
export function isFormReady(form: FormState) {
  return (
    formHasSequence(form) &&
    !!getAssemblyName(form) &&
    !getMissingSidecars(form).length
  )
}

// Whether the user has put anything in the form. A caller that submits a
// separate list (desktop stages several genomes) uses this to refuse rather
// than silently drop a genome the user was halfway through entering.
export function isFormDirty(form: FormState) {
  return formHasSequence(form) || !!getAssemblyName(form)
}

// The non-primary files the built config will actually reference, and the ones
// it won't. chrom.sizes reaches a TwoBitAdapter and nothing else, so listing it
// under a FASTA promises a file getAdapterConfig drops on the floor.
export function partitionExtraLocations(form: FormState) {
  const { adapterSelection } = form
  const required = requiredSidecars[adapterSelection]
  const twoBit = adapterSelection === 'TwoBitAdapter'
  const sidecarLocation = (role: SidecarRole) => form[sidecars[role].field]
  const used = [
    ...required.map(sidecarLocation),
    ...(twoBit ? [form.chromSizesLocation] : []),
    form.refNameAliasesLocation,
    form.cytobandsLocation,
  ].filter(loc => !isBlank(loc))
  const unused = [
    ...sidecarRoles
      .filter(role => !required.includes(role))
      .map(sidecarLocation),
    ...(twoBit ? [] : [form.chromSizesLocation]),
  ].filter(loc => !isBlank(loc))
  return { used, unused }
}

// The FASTA extensions the sequence plugin's adapter guessers accept, so the
// add-genome pane places exactly the files that load everywhere else. Its own
// table used to be `(fa|fasta|fna).gz`, case-sensitive, which silently refused
// .fas, .mfa, .FA and .fa.bgz.
const FASTA_EXT = /\.(fa|fasta|fas|fna|mfa)$/i
const FASTA_GZ_EXT = /\.(fa|fasta|fas|fna|mfa)\.b?gz$/i
const TWOBIT_EXT = /\.2bit$/i

// Every pattern here anchors to the end of the name, which is why getFileName
// drops a URI's query string — a presigned link's few hundred characters of
// signature would otherwise be what these match against.
export function getAssemblyNameFromFilename(filename: string) {
  return filename
    .replace(FASTA_GZ_EXT, '')
    .replace(FASTA_EXT, '')
    .replace(TWOBIT_EXT, '')
}

export function detectAdapterType(filename: string): AdapterType | undefined {
  return FASTA_GZ_EXT.test(filename)
    ? 'BgzipFastaAdapter'
    : TWOBIT_EXT.test(filename)
      ? 'TwoBitAdapter'
      : undefined
}

export type FileRole =
  | 'fasta'
  | 'fastaGz'
  | 'fai'
  | 'gzi'
  | 'twoBit'
  | 'chromSizes'
  | 'cytobands'
  | 'refNameAliases'

// Classify a single filename into the assembly slot it belongs to, by
// extension. Returns undefined for files we can't place. Order matters: index
// sidecars (.fai/.gzi) are checked before the fasta patterns they share a stem
// with, and the fasta patterns before the looser cytoband/alias name matches.
export function classifyFilename(filename: string): FileRole | undefined {
  return /\.fai$/i.test(filename)
    ? 'fai'
    : /\.gzi$/i.test(filename)
      ? 'gzi'
      : TWOBIT_EXT.test(filename)
        ? 'twoBit'
        : FASTA_GZ_EXT.test(filename)
          ? 'fastaGz'
          : FASTA_EXT.test(filename)
            ? 'fasta'
            : /\.chrom\.sizes$/i.test(filename)
              ? 'chromSizes'
              : /cytoband/i.test(filename)
                ? 'cytobands'
                : /alias/i.test(filename)
                  ? 'refNameAliases'
                  : undefined
}

// Sort a dropped/pasted set of files into the assembly form fields, picking the
// adapter and assembly name from whichever file is the primary sequence.
//
// The primary is chosen once, up front, and then answers for the adapter, the
// sequence field and the name together. Letting each branch overwrite as it went
// ran two independent last-wins rules that could disagree: a .2bit ahead of a .fa
// took the adapter while the .fa took the name, so the form opened one genome's
// sequence under the other genome's name, and the "more than one genome" notice
// named the file it was not reading.
export function classifyAssemblyFiles(
  locations: FileLocation[],
): Partial<FormState> {
  const result: Partial<FormState> = {}
  const classified = classifyLocations(locations)
  for (const { location, role } of classified) {
    const field = role && extraFields[role]
    if (field) {
      result[field] = location
    }
  }
  const primary = classified.filter(f => isSequenceRole(f.role)).at(-1)
  if (primary) {
    result.assemblyName = getAssemblyNameFromFilename(
      getFileName(primary.location),
    )
    if (primary.role === 'twoBit') {
      result.twoBitLocation = primary.location
      result.adapterSelection = 'TwoBitAdapter'
    } else {
      result.fastaLocation = primary.location
      result.adapterSelection =
        primary.role === 'fastaGz'
          ? 'BgzipFastaAdapter'
          : // a plain FASTA with no .fai in the set indexes itself on submit
            result.faiLocation
            ? 'IndexedFastaAdapter'
            : 'FastaAdapter'
    }
  }
  return result
}

// The roles that describe the sequence itself. Exactly one of these is the
// genome being added, so a set holding two holds two genomes and the caller
// warns about it.
const sequenceRoles: ReadonlySet<FileRole> = new Set([
  'fasta',
  'fastaGz',
  'twoBit',
])

export function isSequenceRole(role: FileRole | undefined) {
  return role !== undefined && sequenceRoles.has(role)
}

// Where each non-sequence role lands on the form. The sequence roles map to
// nothing on purpose: which field they fill depends on which one is the primary,
// so classifyAssemblyFiles decides that in one place rather than per file.
const extraFields: Record<FileRole, LocationField | undefined> = {
  fai: 'faiLocation',
  gzi: 'gziLocation',
  chromSizes: 'chromSizesLocation',
  cytobands: 'cytobandsLocation',
  refNameAliases: 'refNameAliasesLocation',
  fasta: undefined,
  fastaGz: undefined,
  twoBit: undefined,
}

export interface ClassifiedLocation {
  location: FileLocation
  role: FileRole | undefined
}

// Every location paired with the slot it belongs in, `undefined` for the ones
// that could not be placed. Callers needing more than one answer about the same
// set — what was placed, what wasn't, which files are sequences — get all of
// them out of this one pass.
export function classifyLocations(
  locations: FileLocation[],
): ClassifiedLocation[] {
  return locations.map(location => ({
    location,
    role: classifyFilename(getFileName(location)),
  }))
}

/**
 * Rebuild the file-location fields (plus adapter/name) of `state` from a freshly
 * classified set of dropped/pasted files.
 *
 * The file set is authoritative: a field it says nothing about resets, so
 * deleting a URL from the box clears the slot it filled. `edited` is the way out
 * — the fields the user set by hand, which the classifier never gets to answer
 * for. Without it, typing a .fai into the "this format needs its index" input
 * and then adding one more URL wiped the .fai and the pane re-asked for it.
 *
 * refName aliases and cytobands merge instead of resetting even when untouched:
 * they are the two slots "More options" also fills, and no file set that omits
 * them is making a claim about them.
 */
export function applyClassifiedFiles(
  state: FormState,
  locations: FileLocation[],
  edited: ReadonlySet<keyof FormState>,
): FormState {
  const classified = classifyAssemblyFiles(locations)
  const pick = <K extends keyof FormState>(key: K, reset: FormState[K]) =>
    edited.has(key) ? state[key] : (classified[key] ?? reset)
  return {
    ...state,
    fastaLocation: pick('fastaLocation', blank),
    faiLocation: pick('faiLocation', blank),
    gziLocation: pick('gziLocation', blank),
    twoBitLocation: pick('twoBitLocation', blank),
    chromSizesLocation: pick('chromSizesLocation', blank),
    refNameAliasesLocation: pick(
      'refNameAliasesLocation',
      state.refNameAliasesLocation,
    ),
    cytobandsLocation: pick('cytobandsLocation', state.cytobandsLocation),
    adapterSelection: pick('adapterSelection', state.adapterSelection),
    assemblyName: pick('assemblyName', ''),
  }
}

// Build a full assembly config from the form. A plain FASTA has no index, so
// the caller supplies a resolveFastaAdapter callback (desktop runs an
// out-of-process samtools faidx to make an IndexedFastaAdapter; web keeps an
// UnindexedFastaAdapter) used only for the needsFastaIndex case. The name is
// trimmed and reused for a unique-per-open sequence trackId.
export async function buildAssemblyConf(
  form: FormState,
  resolveFastaAdapter: (
    fastaLocation: FileLocation,
  ) => Promise<AssemblyAdapter> | AssemblyAdapter,
): Promise<AssemblyConf> {
  const name = getAssemblyName(form)
  const result = getAdapterConfig(form)
  const adapter =
    result.kind === 'needsFastaIndex'
      ? await resolveFastaAdapter(result.fastaLocation)
      : result.adapter
  return {
    ...getBaseAssemblyConfig({ ...form, assemblyName: name }),
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: `${name}-${Date.now()}`,
      adapter,
    },
  }
}

export function urlTextToLocations(text: string): FileLocation[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(uri => ({ uri, locationType: 'UriLocation' as const }))
}

// Either a ready-to-use sequence adapter, or a signal that the chosen plain
// FASTA must be resolved (indexed) before it can become a usable adapter. Kept
// as a discriminated union rather than a sentinel property so the caller can't
// accidentally write an un-indexed FASTA into a saved config.
export type AdapterConfigResult =
  | { kind: 'ready'; adapter: AssemblyAdapter }
  | { kind: 'needsFastaIndex'; fastaLocation: FileLocation }

export function getAdapterConfig({
  adapterSelection,
  fastaLocation,
  faiLocation,
  gziLocation,
  twoBitLocation,
  chromSizesLocation,
}: {
  adapterSelection: AdapterType
  fastaLocation: FileLocation
  faiLocation: FileLocation
  gziLocation: FileLocation
  twoBitLocation: FileLocation
  chromSizesLocation: FileLocation
}): AdapterConfigResult {
  if (adapterSelection === 'FastaAdapter') {
    if (isBlank(fastaLocation)) {
      throw new Error('FASTA location is required')
    }
    return { kind: 'needsFastaIndex', fastaLocation }
  }
  if (adapterSelection === 'IndexedFastaAdapter') {
    if (isBlank(fastaLocation) || isBlank(faiLocation)) {
      throw new Error('Both FASTA and FAI locations are required')
    }
    return {
      kind: 'ready',
      adapter: { type: 'IndexedFastaAdapter', fastaLocation, faiLocation },
    }
  }
  if (adapterSelection === 'BgzipFastaAdapter') {
    if (
      isBlank(fastaLocation) ||
      isBlank(faiLocation) ||
      isBlank(gziLocation)
    ) {
      throw new Error('FASTA, FAI, and GZI locations are all required')
    }
    return {
      kind: 'ready',
      adapter: {
        type: 'BgzipFastaAdapter',
        fastaLocation,
        faiLocation,
        gziLocation,
      },
    }
  }
  if (isBlank(twoBitLocation)) {
    throw new Error('2bit location is required')
  }
  return {
    kind: 'ready',
    adapter: isBlank(chromSizesLocation)
      ? { type: 'TwoBitAdapter', twoBitLocation }
      : { type: 'TwoBitAdapter', twoBitLocation, chromSizesLocation },
  }
}
