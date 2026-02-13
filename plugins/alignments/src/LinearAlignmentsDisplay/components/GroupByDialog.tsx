import { useEffect, useState } from 'react'

import { Dialog, ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import {
  type SessionWithAddTracks,
  getContainingTrack,
  getContainingView,
  getSession,
  useDebounce,
} from '@jbrowse/core/util'
import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'
import {
  Button,
  DialogActions,
  DialogContent,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { getUniqueTags } from '../../shared/getUniqueTags.ts'
import { defaultFilterFlags, negFlags, posFlags } from '../../shared/util.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const TAG_REGEX = /^[A-Za-z][A-Za-z0-9]$/

function TagResults({ tag, tagSet }: { tag: string; tagSet: string[] }) {
  if (tagSet.length === 0) {
    return (
      <Typography color="warning.main">
        No values found for tag {tag} in the current region
      </Typography>
    )
  }
  return (
    <div>
      <div>Found unique {tag} values:</div>
      <div>{tagSet.join(', ')}</div>
    </div>
  )
}

function createTrackId(baseId: string, suffix: string) {
  return `${baseId}-${suffix}-${Date.now()}-sessionTrack`
}

function createTagBasedTracks({
  trackConf,
  tag,
  tagSet,
  session,
  view,
}: {
  trackConf: Record<string, unknown>
  tag: string
  tagSet: string[]
  session: SessionWithAddTracks
  view: LinearGenomeViewModel
}) {
  const values = [...tagSet, undefined] as (string | undefined)[]
  for (const tagValue of values) {
    const trackId = createTrackId(
      trackConf.trackId as string,
      `${tag}:${tagValue}`,
    )
    session.addTrackConf({
      ...trackConf,
      trackId,
      name: `${trackConf.name} (${tag}:${tagValue})`,
      displays: [
        {
          displayId: `${trackId}-LinearAlignmentsDisplay`,
          type: 'LinearAlignmentsDisplay',
          filterBySetting: {
            ...defaultFilterFlags,
            tagFilter: {
              tag,
              value: tagValue,
            },
          },
        },
      ],
    })
    view.showTrack(trackId)
  }
}

function createStrandBasedTracks({
  trackConf,
  session,
  view,
}: {
  trackConf: Record<string, unknown>
  session: SessionWithAddTracks
  view: LinearGenomeViewModel
}) {
  const negTrackId = createTrackId(
    trackConf.trackId as string,
    'strand:(-)',
  )
  const posTrackId = createTrackId(
    trackConf.trackId as string,
    'strand:(+)',
  )

  session.addTrackConf({
    ...trackConf,
    trackId: negTrackId,
    name: `${trackConf.name} (-)`,
    displays: [
      {
        displayId: `${negTrackId}-LinearAlignmentsDisplay`,
        type: 'LinearAlignmentsDisplay',
        filterBySetting: negFlags,
      },
    ],
  })
  session.addTrackConf({
    ...trackConf,
    trackId: posTrackId,
    name: `${trackConf.name} (+)`,
    displays: [
      {
        displayId: `${posTrackId}-LinearAlignmentsDisplay`,
        type: 'LinearAlignmentsDisplay',
        filterBySetting: posFlags,
      },
    ],
  })
  view.showTrack(negTrackId)
  view.showTrack(posTrackId)
}

const GroupByDialog = observer(function GroupByDialog(props: {
  model: {
    adapterConfig: AnyConfigurationModel
    configuration: AnyConfigurationModel
  } & IAnyStateTreeNode
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const [tag, setGroupByTag] = useState('')
  const [tagSet, setGroupByTagSet] = useState<string[]>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>()

  const validTag = TAG_REGEX.exec(tag)
  const isInvalid = tag.length === 2 && !validTag
  const debouncedTag = useDebounce(tag, 1000)
  const [type, setType] = useState('')

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      const isValidTag = TAG_REGEX.test(debouncedTag)
      if (type === 'tag' && isValidTag) {
        try {
          setError(undefined)
          setLoading(true)
          const vals = await getUniqueTags({
            self: model,
            tag: debouncedTag,
            blocks: (getContainingView(model) as LinearGenomeViewModel)
              .staticBlocks,
          })
          setGroupByTagSet(vals)
        } catch (e) {
          console.error(e)
          setError(e)
        } finally {
          setLoading(false)
        }
      }
    })()
  }, [model, type, debouncedTag])

  useEffect(() => {
    if (type !== 'tag') {
      setGroupByTagSet(undefined)
      setError(undefined)
      setLoading(false)
    }
  }, [type])

  return (
    <Dialog open onClose={handleClose} title="Group by">
      <DialogContent>
        <Typography>
          NOTE: this will create new session tracks with the "filter by" set to
          the values chosen here rather than affecting the current track state
        </Typography>
        <TextField
          fullWidth
          value={type}
          onChange={event => {
            setType(event.target.value)
          }}
          label="Group by..."
          select
        >
          <MenuItem value="strand">Strand</MenuItem>
          <MenuItem value="tag">Tag</MenuItem>
        </TextField>
        {type === 'tag' ? (
          <>
            <Typography color="textSecondary">
              Examples: HP for haplotype, RG for read group, etc.
            </Typography>

            <TextField
              value={tag}
              onChange={event => {
                setGroupByTag(event.target.value)
              }}
              placeholder="Enter tag name"
              error={isInvalid}
              helperText={isInvalid ? 'Not a valid tag' : ''}
              autoComplete="off"
              data-testid="group-tag-name"
              slotProps={{
                htmlInput: {
                  maxLength: 2,
                  'data-testid': 'group-tag-name-input',
                },
              }}
            />
            {error ? (
              <ErrorMessage error={error} />
            ) : loading ? (
              <LoadingEllipses message="Loading unique tags" />
            ) : tagSet ? (
              <TagResults tag={tag} tagSet={tagSet} />
            ) : null}
          </>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          type="submit"
          disabled={
            !type ||
            loading ||
            (type === 'tag' && (!tagSet || tagSet.length === 0))
          }
          autoFocus
          onClick={() => {
            const track = getContainingTrack(model)
            const trackConf = isStateTreeNode(track.configuration)
              ? structuredClone(getSnapshot(track.configuration))
              : track.configuration
            const session = getSession(model) as SessionWithAddTracks
            const view = getContainingView(model) as LinearGenomeViewModel

            if (type === 'tag' && tagSet) {
              createTagBasedTracks({
                trackConf: trackConf as Record<string, unknown>,
                tag,
                tagSet,
                session,
                view,
              })
            } else if (type === 'strand') {
              createStrandBasedTracks({
                trackConf: trackConf as Record<string, unknown>,
                session,
                view,
              })
            }

            handleClose()
          }}
        >
          Submit
        </Button>
        <Button variant="contained" color="secondary" onClick={handleClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default GroupByDialog
