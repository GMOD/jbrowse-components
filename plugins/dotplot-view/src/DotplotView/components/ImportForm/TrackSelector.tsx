import { Suspense } from 'react'

import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { getEnv } from '@jbrowse/core/util'
import {
  ImportFormOpenCustomTrack,
  ImportFormSyntenyChoiceRadioGroup,
  NoSyntenyTrackMessage,
  PreConfiguredSyntenyTrackSelect,
  useImportFormSyntenyChoice,
} from '@jbrowse/synteny-core'
import { CircularProgress, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// #region option
export interface DotplotImportFormSyntenyOption {
  /** unique identifier for the radio option */
  value: string
  /** display text for the radio option */
  label: string
  ReactComponent: React.FC<{
    model: DotplotViewModel
    assembly1: string
    assembly2: string
  }>
}
// #endregion

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    // #region registry
    'DotplotView-ImportFormSyntenyOptions': {
      args: DotplotImportFormSyntenyOption[]
      result: DotplotImportFormSyntenyOption[]
      props: {
        model: DotplotViewModel
        /** name of the y-axis assembly */
        assembly1: string
        /** name of the x-axis assembly */
        assembly2: string
      }
    }
    // #endregion
  }
}

const TrackSelector = observer(function TrackSelector({
  model,
  assemblyX,
  assemblyY,
  syntenyTracks,
}: {
  model: DotplotViewModel
  assemblyX: string
  assemblyY: string
  syntenyTracks: AnyConfigurationModel[]
}) {
  const { pluginManager } = getEnv(model)

  // extension-point and core components use the public assembly1/assembly2
  // (y-axis/x-axis) prop names
  const assembly1 = assemblyY
  const assembly2 = assemblyX

  const { choice, setChoice } = useImportFormSyntenyChoice(model, 0)

  const customOptions = pluginManager.evaluateExtensionPoint(
    /** #extensionPoint DotplotView-ImportFormSyntenyOptions | sync | Add options to the dotplot view import form */
    'DotplotView-ImportFormSyntenyOptions',
    [],
    { model, assembly1, assembly2 },
  )

  const selectedCustomOption = customOptions.find(opt => opt.value === choice)

  return (
    <>
      <ImportFormSyntenyChoiceRadioGroup
        choice={choice}
        onChange={setChoice}
        customOptions={customOptions}
        label="(Optional) Select or add a synteny track"
      />
      {choice === 'custom' ? (
        <ImportFormOpenCustomTrack
          model={model}
          rowIndex={0}
          /** #extensionPoint DotplotView-SyntenyFileFormats | sync | Add synteny file formats to the dotplot import form */
          extensionPoint="DotplotView-SyntenyFileFormats"
          assembly1={assembly1}
          assembly2={assembly2}
        />
      ) : null}
      {choice === 'tracklist' ? (
        <PreConfiguredSyntenyTrackSelect
          model={model}
          tracks={syntenyTracks}
          rowIndex={0}
          emptyState={
            <NoSyntenyTrackMessage
              assembly1={assembly1}
              assembly2={assembly2}
              remedy='Choose "New track" above to add one.'
            />
          }
        >
          <Typography variant="body2" color="text.secondary">
            More synteny tracks can be toggled inside the dotplot from the track
            selector <TrackSelectorIcon />; multiple can show at once.
          </Typography>
        </PreConfiguredSyntenyTrackSelect>
      ) : null}
      {selectedCustomOption ? (
        <Suspense fallback={<CircularProgress size={20} />}>
          <selectedCustomOption.ReactComponent
            model={model}
            assembly1={assembly1}
            assembly2={assembly2}
          />
        </Suspense>
      ) : null}
    </>
  )
})

export default TrackSelector
