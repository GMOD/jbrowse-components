import { Suspense } from 'react'

import { getSession } from '@jbrowse/core/util'
import { allSessionTracks } from '@jbrowse/core/util/tracks'
import { CircularProgress } from '@mui/material'
import { observer } from 'mobx-react'

import ImportFormOpenCustomTrack from './ImportFormOpenCustomTrack.tsx'
import ImportFormSyntenyChoiceRadioGroup from './ImportFormSyntenyChoiceRadioGroup.tsx'
import NoSyntenyTrackMessage from './NoSyntenyTrackMessage.tsx'
import PreConfiguredSyntenyTrackSelect from './PreConfiguredSyntenyTrackSelect.tsx'
import { getSyntenyTracks } from './getSyntenyTracks.ts'

import type {
  ImportFormSyntenyModel,
  SyntenyFileFormatsExtensionPoint,
} from './SelectorTypes.ts'
import type { ImportFormSyntenyChoices } from './useImportFormSyntenyChoices.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * "Which synteny track backs this pair of assemblies" — the whole radio group
 * and whichever body the choice implies. One row of the linear synteny import
 * form, or the dotplot import form's single row.
 *
 * The two forms used to each own a copy of this. They were the same component
 * with four strings different, and every divergence between them was a bug
 * nobody meant to write, so what is genuinely per-view is now props: the file
 * formats extension point, the empty-state remedy, the hint under the picker,
 * and how the group is labelled.
 *
 * The *options* extension point stays with each view, because its props differ
 * (the synteny form's carries `selectedRow`) and its registration is part of
 * that view's published API. This takes the evaluated list and a way to render
 * the selected one, so neither of those has to be described generically.
 */
const ImportFormSyntenyTrackPanel = observer(
  function ImportFormSyntenyTrackPanel({
    model,
    rowIndex,
    assembly1,
    assembly2,
    choices,
    fileFormatsExtensionPoint,
    customOptions,
    renderCustomOption,
    label,
    labelledBy,
    emptyRemedy,
    children,
  }: {
    model: ImportFormSyntenyModel & IStateTreeNode
    /** which row pair of the form this panel configures; 0 for a dotplot */
    rowIndex: number
    assembly1: string
    assembly2: string
    /** the form's per-pair radio state, which outlives this panel's remount */
    choices: ImportFormSyntenyChoices
    fileFormatsExtensionPoint: SyntenyFileFormatsExtensionPoint
    /** the view's own ImportFormSyntenyOptions point, already evaluated */
    customOptions: { value: string; label: string }[]
    renderCustomOption: (value: string) => React.ReactNode
    /** names the radio group here; see ImportFormSyntenyChoiceRadioGroup */
    label?: string
    /** id of a heading the caller already renders, which names the group */
    labelledBy?: string
    /** the view's way out when nothing connects the pair */
    emptyRemedy: string
    /** note shown under a populated track picker */
    children?: React.ReactNode
  }) {
    const session = getSession(model)
    const { choice, setChoice } = choices.forPair(
      rowIndex,
      assembly1,
      assembly2,
    )
    const customSelected = customOptions.some(opt => opt.value === choice)

    return (
      <div>
        <ImportFormSyntenyChoiceRadioGroup
          choice={choice}
          onChange={setChoice}
          customOptions={customOptions}
          label={label}
          labelledBy={labelledBy}
        />
        {choice === 'custom' ? (
          <ImportFormOpenCustomTrack
            model={model}
            rowIndex={rowIndex}
            extensionPoint={fileFormatsExtensionPoint}
            assembly1={assembly1}
            assembly2={assembly2}
          />
        ) : null}
        {choice === 'tracklist' ? (
          <PreConfiguredSyntenyTrackSelect
            model={model}
            // scanned here rather than by the form above, so the config reads
            // only happen while this radio is the one selected
            tracks={getSyntenyTracks(
              allSessionTracks(session),
              [assembly1, assembly2],
              session.assemblyManager,
            )}
            rowIndex={rowIndex}
            emptyState={
              <NoSyntenyTrackMessage
                assembly1={assembly1}
                assembly2={assembly2}
                remedy={emptyRemedy}
              />
            }
          >
            {children}
          </PreConfiguredSyntenyTrackSelect>
        ) : null}
        {customSelected ? (
          <Suspense fallback={<CircularProgress size={20} />}>
            {renderCustomOption(choice)}
          </Suspense>
        ) : null}
      </div>
    )
  },
)

export default ImportFormSyntenyTrackPanel
