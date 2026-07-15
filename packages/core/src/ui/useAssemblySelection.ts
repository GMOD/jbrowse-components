import { useLocalStorage } from '../util/index.ts'

import type { AbstractSessionModel } from '../util/index.ts'

// remember the last assembly per host/path/config so reloads (and embedded
// apps sharing a host) reopen on the same one
function rememberedAssemblyKey(localStorageKey: string) {
  const config = new URLSearchParams(window.location.search).get('config')
  return `lastAssembly-${[
    window.location.host + window.location.pathname,
    config,
    localStorageKey,
  ].join('-')}`
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
    rememberedAssemblyKey(localStorageKey ?? ''),
    undefined,
    typeof jest === 'undefined' && Boolean(localStorageKey),
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
