import { useState } from 'react'

import { Dialog, ErrorBanner } from '@jbrowse/core/ui'
import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { buildClusteredLayout } from '@jbrowse/tree-sidebar'
import {
  Button,
  DialogActions,
  DialogContent,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { TreeSource } from '@jbrowse/tree-sidebar'

// Layout entries may carry additional per-row overrides (e.g. `label`) beyond
// the bare TreeSource shape — buildClusteredLayout preserves them.
interface LayoutEntry extends TreeSource {
  label?: string
}

type ClusterDialogModel = IAnyStateTreeNode & {
  adapterConfig: AnyConfigurationModel
  sources: LayoutEntry[]
  layout: LayoutEntry[]
  setLayoutAndClusterTree: (layout: LayoutEntry[], tree?: string) => void
}

const ClusterIdentityDialog = observer(function ClusterIdentityDialog({
  model,
  handleClose,
}: {
  model: ClusterDialogModel
  handleClose: () => void
}) {
  const [progress, setProgress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>()
  const [stopToken, setStopToken] = useState<StopToken>()
  const { rpcManager } = getSession(model)
  const sources = model.sources
  return (
    <Dialog
      open
      title="Cluster genomes by identity"
      onClose={(_, reason) => {
        if (reason !== 'backdropClick') {
          handleClose()
        }
      }}
    >
      <DialogContent>
        <Typography style={{ marginBottom: 20 }}>
          Clusters the visible genomes by mean alignment identity in bins
          across the current view, using hierarchical clustering.
        </Typography>
        {loading ? (
          <div style={{ padding: 20 }}>
            <span>{progress || 'Loading...'}</span>
            <Button
              onClick={() => {
                stopStopToken(stopToken)
              }}
            >
              Stop
            </Button>
          </div>
        ) : null}
        {error ? <ErrorBanner error={error} /> : null}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          disabled={loading || sources.length < 2}
          onClick={async () => {
            try {
              setError(undefined)
              setProgress('Initializing')
              setLoading(true)
              const view = getContainingView(model) as LinearGenomeViewModel
              if (!view.initialized) {
                return
              }
              const sessionId = getRpcSessionId(model)
              const token = createStopToken()
              setStopToken(token)
              const ret = await rpcManager.call(
                sessionId,
                'MultiLGVSyntenyClusterIdentityMatrix',
                {
                  adapterConfig: model.adapterConfig,
                  regions: view.dynamicBlocks.contentBlocks,
                  sources,
                  bpPerPx: view.bpPerPx,
                  sessionId,
                  stopToken: token,
                  statusCallback: (arg: string) => {
                    setProgress(arg)
                  },
                },
              )
              model.setLayoutAndClusterTree(
                buildClusteredLayout(sources, model.layout, ret.order),
                ret.tree,
              )
              handleClose()
            } catch (e) {
              if (!isAbortException(e) && isAlive(model)) {
                console.error(e)
                setError(e)
              }
            } finally {
              setLoading(false)
              setProgress('')
              setStopToken(undefined)
            }
          }}
        >
          Run clustering
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            handleClose()
            if (stopToken) {
              stopStopToken(stopToken)
            }
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default ClusterIdentityDialog
