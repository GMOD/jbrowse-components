import { useState } from 'react'

import { remapImportFormSelections } from './remapSelectionsToPairs.ts'
import { useChromosomeFilters } from './useChromosomeFilters.ts'
import { useImportFormSyntenyChoices } from './useImportFormSyntenyChoices.ts'

import type { ImportFormSyntenyModel } from './SelectorTypes.ts'

/**
 * Two different assemblies where the session has two, so Manual does not open
 * on a same-assembly pair. Derived from the live list rather than snapshotted at
 * mount: a connection's assemblies arrive after the form is already showing,
 * and a row seeded from the empty list stayed blank for the session.
 */
export function defaultImportFormRows(assemblyNames: string[]) {
  const first = assemblyNames[0] ?? ''
  return [first, assemblyNames[1] ?? first]
}

/**
 * The Manual half of an import form's state: the assembly rows, which pair is
 * being configured, the chromosome text per row and the radio choice per pair.
 * The last three are indexed by row or pair position but are *about* an
 * assembly or a pair of them, so every edit to the rows has to move them along.
 * `applyRows` is the one way the rows change, which is what keeps the four in
 * step; a dotplot's two axes are rows 0 (x) and 1 (y).
 *
 * Takes the session's assembly names as a value, not the session: this is a
 * hook, so it is compiled, and a getter read inside a call here memoizes on the
 * session's identity and never sees a later assembly arrive.
 */
export function useImportFormRows(
  model: ImportFormSyntenyModel,
  assemblyNames: string[],
) {
  const [chosenRows, setChosenRows] = useState<string[]>()
  const rows = chosenRows ?? defaultImportFormRows(assemblyNames)
  const [selectedPair, setSelectedPair] = useState(0)
  const chromosomes = useChromosomeFilters()
  const choices = useImportFormSyntenyChoices(model)

  return {
    rows,
    selectedPair,
    setSelectedPair,
    chromosomes,
    choices,
    /** rows naming an assembly the session does not have, which Launch cannot open */
    missingAssemblyRows: rows.flatMap((row, idx) =>
      assemblyNames.includes(row) ? [] : [idx],
    ),
    applyRows(next: string[], nextSelectedPair: number) {
      choices.remap(remapImportFormSelections(model, rows, next))
      chromosomes.remap(rows, next)
      setChosenRows(next)
      setSelectedPair(nextSelectedPair)
    },
    /**
     * the Quick start handover: a whole new set of rows, so nothing typed
     * against the old ones still applies
     */
    reset(next: string[]) {
      chromosomes.reset()
      setChosenRows(next)
      setSelectedPair(0)
    },
  }
}

export type ImportFormRows = ReturnType<typeof useImportFormRows>
