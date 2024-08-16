import React, { useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { Dialog, ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { getSnapshot, IAnyStateTreeNode } from 'mobx-state-tree'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  useDebounce,
} from '@jbrowse/core/util'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { getUniqueTagValues } from '../../shared'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

function clone(c: unknown) {
  return JSON.parse(JSON.stringify(c))
}

const GroupByTagDialog = observer(function (props: {
  model: {
    adapterConfig: AnyConfigurationModel
    configuration: AnyConfigurationModel
  } & IAnyStateTreeNode
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const [tag, setTag] = useState('')
  const [tagSet, setTagSet] = useState<string[]>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>()

  const validTag = /^[A-Za-z][A-Za-z0-9]$/.exec(tag)
  const isInvalid = tag.length === 2 && !validTag
  const debouncedTag = useDebounce(tag, 1000)
  console.log({ debouncedTag, validTag, isInvalid })
  useEffect(() => {
    ;(async () => {
      try {
        if (!isInvalid) {
          setError(undefined)
          setLoading(true)
          const vals = await getUniqueTagValues({
            self: model,
            tag: debouncedTag,
            blocks: (getContainingView(model) as LinearGenomeViewModel)
              .staticBlocks,
          })
          setTagSet(vals)
        }
      } catch (e) {
        console.error(e)
        setError(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [model, isInvalid, debouncedTag])
  return (
    <Dialog open onClose={handleClose} title="Group by tag">
      <DialogContent>
        <Typography>Set the tag to group by</Typography>
        <Typography color="textSecondary">
          Examples: HP for haplotype, RG for read group, etc.
        </Typography>
        <TextField
          value={tag}
          onChange={event => {
            setTag(event.target.value)
          }}
          placeholder="Enter tag name"
          inputProps={{
            maxLength: 2,
            'data-testid': 'group-tag-name-input',
          }}
          error={isInvalid}
          helperText={isInvalid ? 'Not a valid tag' : ''}
          autoComplete="off"
          data-testid="group-tag-name"
        />
        {error ? (
          <ErrorMessage error={error} />
        ) : loading ? (
          <LoadingEllipses title="Loading unique tags" />
        ) : tagSet ? (
          <div>
            <div>Found unique {tag} values:</div>
            <div>{tagSet.join(', ')}</div>
          </div>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          type="submit"
          disabled={!tagSet}
          autoFocus
          onClick={() => {
            // @ts-expect-error
            const displayState = clone(getSnapshot(model))
            const track = getContainingTrack(model)
            const trackConf = clone(getSnapshot(track.configuration))
            const session = getSession(model)
            if (tagSet) {
              for (const tagValue of tagSet) {
                // @ts-expect-error
                const track = session.addTrackConf({
                  ...trackConf,
                  trackId: `${trackConf.trackId}-${tag}:${tagValue}`,
                  name: `${trackConf.name} ${tag}:${tagValue}`,
                  displays: undefined,
                })
                console.log({
                  trackConf,
                  new: {
                    ...trackConf,
                    trackId: `${trackConf.trackId}-${tag}-${tagValue}`,
                    displays: undefined,
                  },
                })
                console.log(track)
                const view = getContainingView(model) as LinearGenomeViewModel
                const t = view.showTrack(track.trackId)
                const d = t.displays[0] as LinearAlignmentsDisplayModel
                d.SNPCoverageDisplay.setFilter({
                  filterBy: {
                    ...track.filterBy,
                    tagFilter: {
                      tag,
                      value: tagValue,
                    },
                  },
                })
                d.LinearPileupDisplay.setFilter({
                  filterBy: {
                    ...track.filterBy,
                    tagFilter: {
                      tag,
                      value: tagValue,
                    },
                  },
                })
              }
            }
            handleClose()
          }}
        >
          Submit
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            handleClose()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default GroupByTagDialog
