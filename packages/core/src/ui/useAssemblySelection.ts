import { useLocalStorage } from '../util/hooks.ts'

import type { AbstractSessionModel } from '../util/index.ts'

// scope a localStorage key to this host/path/config so reloads (and embedded
// apps sharing a host) see their own value. Shared by the remembered-assembly
// and recent-locations persistence
//
// The near-twin is data-management's `configScopedKey`, and the two must NOT be
// merged even though they are the same idea. They disagree on every detail that
// reaches the output: this one includes the host, joins unfiltered (so a page
// with no `?config=` genuinely stores a literal `null` segment) and assumes a
// browser; that one omits the host, filters empty parts out, and answers
// `'empty'` off-window. So a "cleanup" that unified them would re-key every
// stored setting on both sides at once — remembered assembly and recent
// locations here, hidden columns and widths there — and every user would find
// their settings silently back at the defaults. Touch either spelling only as a
// deliberate migration.
export function instanceScopedKey(prefix: string, suffix: string) {
  const config = new URLSearchParams(window.location.search).get('config')
  return [
    prefix,
    window.location.host + window.location.pathname,
    config,
    suffix,
  ].join('-')
}

/**
 * Tracks the assembly chosen in an import form and resolves the outcomes the
 * form renders from: `assemblyError` (failed, or nothing configured), `regions`
 * (ready), or neither (still loading). The user's choice is stored as an
 * override and re-resolved against the live assembly list every render, so it
 * always names a currently-configured assembly even as assemblies load in, get
 * removed, or when a remembered choice is no longer valid. Passing a
 * `localStorageKey` persists the choice across reloads. Shared by the LGV and
 * circular-view import forms.
 */
export function useAssemblySelection(
  session: AbstractSessionModel,
  localStorageKey?: string,
) {
  const { assemblyNames, assemblyManager } = session
  const [override, setOverride] = useLocalStorage<string | undefined>(
    instanceScopedKey('lastAssembly', localStorageKey ?? ''),
    undefined,
    Boolean(localStorageKey),
  )
  const selectedAssemblyName = assemblyNames.includes(override ?? '')
    ? override
    : assemblyNames[0]

  const assembly = selectedAssemblyName
    ? assemblyManager.get(selectedAssemblyName)
    : undefined
  const assemblyError = assemblyNames.length
    ? assembly?.error
    : 'No configured assemblies'
  return {
    selectedAssemblyName,
    setSelectedAssemblyName: setOverride,
    assembly,
    assemblyError,
    regions: assembly?.regions,
  }
}
