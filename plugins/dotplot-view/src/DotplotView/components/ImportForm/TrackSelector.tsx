import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { getEnv } from '@jbrowse/core/util'
import { ImportFormSyntenyTrackPanel } from '@jbrowse/synteny-core'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../../model.ts'
import type { ImportFormSyntenyChoices } from '@jbrowse/synteny-core'

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

/**
 * The dotplot's binding of the shared import-form track panel: it declares this
 * view's options extension point (whose props differ from the synteny view's,
 * which is why the point stays here) and hands the panel the dotplot's wording.
 */
const TrackSelector = observer(function TrackSelector({
  model,
  assemblyX,
  assemblyY,
  choices,
}: {
  model: DotplotViewModel
  assemblyX: string
  assemblyY: string
  choices: ImportFormSyntenyChoices
}) {
  const { pluginManager } = getEnv(model)

  // extension-point and core components use the public assembly1/assembly2
  // (y-axis/x-axis) prop names
  const assembly1 = assemblyY
  const assembly2 = assemblyX

  const customOptions = pluginManager.evaluateExtensionPoint(
    /** #extensionPoint DotplotView-ImportFormSyntenyOptions | sync | Add options to the dotplot view import form */
    'DotplotView-ImportFormSyntenyOptions',
    [],
    { model, assembly1, assembly2 },
  )

  return (
    <ImportFormSyntenyTrackPanel
      model={model}
      rowIndex={0}
      assembly1={assembly1}
      assembly2={assembly2}
      choices={choices}
      /** #extensionPoint DotplotView-SyntenyFileFormats | sync | Add synteny file formats to the dotplot import form */
      fileFormatsExtensionPoint="DotplotView-SyntenyFileFormats"
      label="(Optional) Select or add a synteny track"
      customOptions={customOptions}
      renderCustomOption={value => {
        const option = customOptions.find(opt => opt.value === value)
        return option ? (
          <option.ReactComponent
            model={model}
            assembly1={assembly1}
            assembly2={assembly2}
          />
        ) : null
      }}
      emptyRemedy='Choose "New track" above to add one.'
    >
      <Typography variant="body2" color="text.secondary">
        More synteny tracks can be toggled inside the dotplot from the track
        selector <TrackSelectorIcon />; multiple can show at once.
      </Typography>
    </ImportFormSyntenyTrackPanel>
  )
})

export default TrackSelector
