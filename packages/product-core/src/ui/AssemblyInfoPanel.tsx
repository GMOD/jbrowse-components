import { useState } from 'react'

import Attributes from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/Attributes'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { readConfObject, readConfSlot } from '@jbrowse/core/configuration'
import { CopyToClipboardButton } from '@jbrowse/core/ui'
import { stripBaseUris } from '@jbrowse/core/util/addRelativeUris'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getParent, hasParent, isStateTreeNode } from '@jbrowse/mobx-state-tree'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import RefNameAliasesDialog from './RefNameAliasesDialog.tsx'

import type { AboutConfig, AboutPanelProps } from './util.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// `Attributes` omits these at every depth, which is what reaches the two that
// are nested:
// - `sequence` is the config of the very track this dialog is about, in the
//   card above
// - `features` is an inline adapter's whole data payload. An assembly whose
//   aliases or cytobands are written into the config rather than fetched from a
//   file rendered them here as a spreadsheet of the raw rows, which buried the
//   four lines anyone opened the card for — and it is the same data the alias
//   listing shows resolved, one button over
// - `adapterId` is a generated hash, and `baseUri` is where the config was
//   loaded from rather than anything about the assembly
//
// Nothing is hidden from "Copy assembly config", which copies the config whole.
const hideFields = ['sequence', 'features', 'adapterId', 'baseUri']

const useStyles = makeStyles()(theme => ({
  buttons: {
    float: 'right',
    display: 'flex',
    gap: theme.spacing(1),
  },
}))

/**
 * The assembly config a `ReferenceSequenceTrack` config hangs off, and
 * undefined for every other track.
 *
 * A reference sequence track declares no `assemblyNames` slot — the config node
 * holding it *is* its assembly, the same walk `getConfAssemblyNames` makes.
 * Compared by identity against that node's `sequence`, so the card is the
 * assembly of the track the dialog is already showing.
 *
 * Both menus that open this dialog hand over a live node here: the hierarchical
 * selector reads `assemblyManager.get(name).configuration.sequence`, and the
 * in-view track label's `track.configuration` resolves to that same node
 * through `getTrackById`. The frozen `session.tracks` entry the rest of the
 * dialog has to cope with is never a reference sequence track.
 */
function getAssemblyConf(config: AboutConfig) {
  const parent =
    isStateTreeNode(config) && hasParent(config)
      ? getParent<AnyConfigurationModel & { sequence?: unknown }>(config)
      : undefined
  return parent?.sequence === config ? parent : undefined
}

const AssemblyCard = observer(function AssemblyCard({
  assemblyConf,
  session,
  hideUris,
}: {
  assemblyConf: AnyConfigurationModel
  session: AbstractSessionModel
  hideUris?: boolean
}) {
  const { classes } = useStyles()
  const [showAliases, setShowAliases] = useState(false)
  const conf = readConfObject(assemblyConf)

  return (
    <BaseCard title="Assembly">
      <span className={classes.buttons}>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            setShowAliases(true)
          }}
        >
          Show ref name aliases
        </Button>
        {/* same rule as the track card's Copy config: the assembly config
            carries the sequence, alias and cytoband file locations */}
        {hideUris ? null : (
          <CopyToClipboardButton
            variant="contained"
            value={() =>
              JSON.stringify(stripBaseUris(structuredClone(conf)), null, 2)
            }
          >
            Copy assembly config
          </CopyToClipboardButton>
        )}
      </span>
      <Attributes attributes={conf} omit={hideFields} hideUris={hideUris} />
      {showAliases ? (
        <RefNameAliasesDialog
          assemblyName={readConfSlot<string>(assemblyConf, 'name')}
          session={session}
          onClose={() => {
            setShowAliases(false)
          }}
        />
      ) : null}
    </BaseCard>
  )
})

const AssemblyInfoPanel = observer(function AssemblyInfoPanel({
  config,
  session,
  hideUris,
}: AboutPanelProps & { hideUris?: boolean }) {
  const assemblyConf = getAssemblyConf(config)

  return assemblyConf ? (
    <AssemblyCard
      assemblyConf={assemblyConf}
      session={session}
      hideUris={hideUris}
    />
  ) : null
})

export default AssemblyInfoPanel
