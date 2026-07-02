import { useState } from 'react'

import type { AbstractSessionModel } from '../util/index.ts'

/**
 * Tracks the assembly chosen in an import form and resolves the outcomes the
 * form renders from: `assemblyError` (failed, or nothing configured), `regions`
 * (ready), or neither (still loading). The user's choice is stored as an
 * override and re-resolved against the live assembly list every render, so it
 * always names a currently-configured assembly even as assemblies load in, get
 * removed, or when a remembered choice is no longer valid. Shared by the LGV and
 * circular-view import forms.
 */
export function useAssemblySelection(session: AbstractSessionModel) {
  const { assemblyNames, assemblyManager } = session
  const [override, setOverride] = useState<string>()
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
