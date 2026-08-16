import { getFileName } from './getFileName.ts'
import { isLocalPathLocation, isUriLocation } from './types/index.ts'

import type { FileLocation } from './types/index.ts'

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
  const wantsFai =
    adapterSelection === 'IndexedFastaAdapter' ||
    adapterSelection === 'BgzipFastaAdapter'
  const wantsGzi = adapterSelection === 'BgzipFastaAdapter'
  const fai =
    wantsFai && isBlank(state.faiLocation)
      ? sidecar(location, '.fai')
      : undefined
  const gzi =
    wantsGzi && isBlank(state.gziLocation)
      ? sidecar(location, '.gzi')
      : undefined
  return {
    ...(fai ? { faiLocation: fai } : {}),
    ...(gzi ? { gziLocation: gzi } : {}),
  }
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

export function clearFormFields(state: FormState): FormState {
  return {
    ...state,
    fastaLocation: blank,
    faiLocation: blank,
    gziLocation: blank,
    twoBitLocation: blank,
    chromSizesLocation: blank,
    refNameAliasesLocation: blank,
    cytobandsLocation: blank,
    assemblyName: '',
    assemblyDisplayName: '',
  }
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

// The index files the chosen format requires that the form doesn't have yet,
// named the way the UI names them. getAdapterConfig throws on the same
// condition; asking first is what lets a caller disable its submit button
// instead of letting the user click it and read a stack trace back.
export function getMissingRequirements(form: FormState) {
  const { adapterSelection } = form
  const needsFai =
    adapterSelection === 'IndexedFastaAdapter' ||
    adapterSelection === 'BgzipFastaAdapter'
  return [
    ...(needsFai && isBlank(form.faiLocation) ? ['.fai'] : []),
    ...(adapterSelection === 'BgzipFastaAdapter' && isBlank(form.gziLocation)
      ? ['.gzi']
      : []),
  ]
}

// Whether the form can be submitted/staged: a primary sequence file, everything
// that file's format requires, and a (non-whitespace) name. Shared so every
// add-assembly surface gates its submit button the same way.
export function isFormReady(form: FormState) {
  return (
    formHasSequence(form) &&
    !!getAssemblyName(form) &&
    !getMissingRequirements(form).length
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
  const needsFai =
    adapterSelection === 'IndexedFastaAdapter' ||
    adapterSelection === 'BgzipFastaAdapter'
  const used = [
    ...(needsFai ? [form.faiLocation] : []),
    ...(adapterSelection === 'BgzipFastaAdapter' ? [form.gziLocation] : []),
    ...(adapterSelection === 'TwoBitAdapter' ? [form.chromSizesLocation] : []),
    form.refNameAliasesLocation,
    form.cytobandsLocation,
  ].filter(loc => !isBlank(loc))
  const unused = [
    ...(needsFai ? [] : [form.faiLocation]),
    ...(adapterSelection === 'BgzipFastaAdapter' ? [] : [form.gziLocation]),
    ...(adapterSelection === 'TwoBitAdapter' ? [] : [form.chromSizesLocation]),
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
export function classifyAssemblyFiles(
  locations: FileLocation[],
): Partial<FormState> {
  const result: Partial<FormState> = {}
  let primaryFilename: string | undefined
  for (const location of locations) {
    const filename = getFileName(location)
    const role = classifyFilename(filename)
    if (role === 'fai') {
      result.faiLocation = location
    } else if (role === 'gzi') {
      result.gziLocation = location
    } else if (role === 'twoBit') {
      result.twoBitLocation = location
      result.adapterSelection = 'TwoBitAdapter'
      primaryFilename = filename
    } else if (role === 'fastaGz') {
      result.fastaLocation = location
      result.adapterSelection = 'BgzipFastaAdapter'
      primaryFilename = filename
    } else if (role === 'fasta') {
      result.fastaLocation = location
      if (result.adapterSelection === undefined) {
        result.adapterSelection = 'IndexedFastaAdapter'
      }
      primaryFilename = filename
    } else if (role === 'chromSizes') {
      result.chromSizesLocation = location
    } else if (role === 'cytobands') {
      result.cytobandsLocation = location
    } else if (role === 'refNameAliases') {
      result.refNameAliasesLocation = location
    }
  }
  if (primaryFilename) {
    result.assemblyName = getAssemblyNameFromFilename(primaryFilename)
  }
  // a plain FASTA with no .fai in the set indexes itself on submit
  if (
    result.adapterSelection === 'IndexedFastaAdapter' &&
    result.faiLocation === undefined
  ) {
    result.adapterSelection = 'FastaAdapter'
  }
  return result
}

// The roles that describe the sequence itself. A file set is authoritative over
// these — one not present in `locations` resets to blank, so removing an input
// clears its field.
const sequenceRoles: ReadonlySet<FileRole> = new Set([
  'fasta',
  'fastaGz',
  'twoBit',
])

// The members of a dropped set that are a primary sequence file, in the order
// classifyAssemblyFiles reads them — so the last is the one it keeps. Two of
// them means two genomes arrived at once and the form, which holds one at a
// time, silently kept the second; the caller warns about that.
export function sequenceLocations(locations: FileLocation[]) {
  return locations.filter(loc => {
    const role = classifyFilename(getFileName(loc))
    return role !== undefined && sequenceRoles.has(role)
  })
}

// Rebuild the file-location fields (plus adapter/name) of `state` from a freshly
// classified set of dropped/pasted files. Sequence fields are authoritative (see
// sequenceRoles). refName aliases and cytobands only merge, because "More
// options" sets those by hand too and a later drop would otherwise wipe an entry
// the file set never had an opinion about. assemblyName comes from the primary
// file unless `keepName` is set (the user edited the name themselves).
export function applyClassifiedFiles(
  state: FormState,
  locations: FileLocation[],
  keepName: boolean,
): FormState {
  const classified = classifyAssemblyFiles(locations)
  return {
    ...state,
    fastaLocation: classified.fastaLocation ?? blank,
    faiLocation: classified.faiLocation ?? blank,
    gziLocation: classified.gziLocation ?? blank,
    twoBitLocation: classified.twoBitLocation ?? blank,
    chromSizesLocation: classified.chromSizesLocation ?? blank,
    refNameAliasesLocation:
      classified.refNameAliasesLocation ?? state.refNameAliasesLocation,
    cytobandsLocation: classified.cytobandsLocation ?? state.cytobandsLocation,
    adapterSelection: classified.adapterSelection ?? state.adapterSelection,
    assemblyName: keepName
      ? state.assemblyName
      : (classified.assemblyName ?? ''),
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
