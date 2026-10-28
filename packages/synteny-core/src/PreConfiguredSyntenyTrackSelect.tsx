import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import SyntenyTrackChoice from './SyntenyTrackChoice.tsx'
import { pickSyntenyTrackId } from './getSyntenyTracks.ts'

import type { ImportFormSyntenyModel } from './SelectorTypes.ts'
import type { AnyTrackConfig } from '@jbrowse/core/configuration'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const useStyles = makeStyles()(theme => ({
  panel: {
    paddingTop: theme.spacing(1),
  },
}))

/**
 * Pre-configured track picker shared by the synteny import forms: the synteny
 * tracks connecting the chosen assemblies, with the pick written into
 * importFormSyntenyTrackSelections[rowIndex]. Callers supply the assembly pair's
 * track list, the empty state, and any note to show under the picker (e.g. the
 * dotplot's in-view track-selector hint).
 */
const PreConfiguredSyntenyTrackSelect = observer(
  function PreConfiguredSyntenyTrackSelect({
    model,
    tracks,
    rowIndex,
    emptyState,
    children,
  }: {
    model: IStateTreeNode & ImportFormSyntenyModel
    tracks: AnyTrackConfig[]
    rowIndex: number
    emptyState: React.ReactNode
    children?: React.ReactNode
  }) {
    const { classes } = useStyles()
    const selection = model.importFormSyntenyTrackSelections[rowIndex]
    const picked = selection?.type === 'preConfigured' ? selection.value : ''
    const value = pickSyntenyTrackId(picked, tracks) ?? ''
    return (
      <div className={classes.panel}>
        {tracks.length ? (
          <>
            <SyntenyTrackChoice
              model={model}
              tracks={tracks}
              value={value}
              onChange={trackId => {
                model.setImportFormSyntenyTrack(rowIndex, {
                  type: 'preConfigured',
                  value: trackId,
                })
              }}
            />
            {children}
          </>
        ) : (
          emptyState
        )}
      </div>
    )
  },
)

export default PreConfiguredSyntenyTrackSelect
