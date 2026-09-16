import { Suspense } from 'react'

import { getEnv, getSession } from '@jbrowse/core/util'
import { allSessionTracks } from '@jbrowse/core/util/tracks'
import { CircularProgress } from '@mui/material'
import { observer } from 'mobx-react'

import ImportFormOpenCustomTrack from './ImportFormOpenCustomTrack.tsx'
import ImportFormSyntenyChoiceRadioGroup from './ImportFormSyntenyChoiceRadioGroup.tsx'
import NoSyntenyTrackMessage from './NoSyntenyTrackMessage.tsx'
import PreConfiguredSyntenyTrackSelect from './PreConfiguredSyntenyTrackSelect.tsx'
import { getSyntenyTracks } from './getSyntenyTracks.ts'

import type { SyntenyImportFormOptionProps } from './SelectorTypes.ts'
import type { ImportFormSyntenyChoices } from './useImportFormSyntenyChoices.ts'

/**
 * "Which synteny track backs this pair of assemblies": the radio group and
 * whichever body the choice implies, for one row pair of any synteny import
 * form. What differs per view is props — the empty-state remedy, the hint under
 * the picker, and how the group is labelled. Plugin options and file formats
 * come from the two `SyntenyImportForm-*` points, evaluated here so every form
 * offers the same ones.
 */
const ImportFormSyntenyTrackPanel = observer(
  function ImportFormSyntenyTrackPanel({
    model,
    rowIndex,
    assembly1,
    assembly2,
    choices,
    label,
    labelledBy,
    emptyRemedy,
    children,
  }: SyntenyImportFormOptionProps & {
    /** the form's per-pair radio state, which outlives this panel's remount */
    choices: ImportFormSyntenyChoices
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
    const { pluginManager } = getEnv(model)
    const { choice, setChoice } = choices.forPair(rowIndex)
    const optionProps = { model, rowIndex, assembly1, assembly2 }
    const customOptions = pluginManager.evaluateExtensionPoint(
      /** #extensionPoint SyntenyImportForm-Options | sync | Add track options beside None / Existing track / New track in every synteny import form */
      'SyntenyImportForm-Options',
      [],
      optionProps,
    )
    const CustomOption = customOptions.find(
      opt => opt.value === choice,
    )?.ReactComponent

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
        {CustomOption ? (
          <Suspense fallback={<CircularProgress size={20} />}>
            <CustomOption {...optionProps} />
          </Suspense>
        ) : null}
      </div>
    )
  },
)

export default ImportFormSyntenyTrackPanel
