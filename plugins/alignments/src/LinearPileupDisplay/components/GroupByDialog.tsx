import React, { useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  MenuItem,
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
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import { getUniqueTags } from '../../shared/getUniqueTags'
import { LinearAlignmentsDisplayModel } from '../../LinearAlignmentsDisplay/model'
import { defaultFilterFlags } from '../../shared/util'

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
  const [tag, setGroupByTag] = useState('')
  const [tagSet, setGroupByTagSet] = useState<string[]>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>()
  const [includeUndefined, setIncludeUndefined] = useState(true)

  const validTag = /^[A-Za-z][A-Za-z0-9]$/.exec(tag)
  const isInvalid = tag.length === 2 && !validTag
  const debouncedTag = useDebounce(tag, 1000)
  const [type, setType] = useState('')

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        if (!isInvalid) {
          setError(undefined)
          setLoading(true)
          const vals = await getUniqueTags({
            self: model,
            tag: debouncedTag,
            blocks: (getContainingView(model) as LinearGenomeViewModel)
              .staticBlocks,
          })
          setGroupByTagSet(vals)
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
    <Dialog open onClose={handleClose} title="Group by">
      <DialogContent>
        <TextField
          fullWidth
          value={type}
          onChange={event => setType(event.target.value)}
          label="Group by..."
          select
        >
          <MenuItem value="strand">Strand</MenuItem>
          <MenuItem value="tag">Tag</MenuItem>
        </TextField>
        {type === 'tag' ? (
          <>
            <Typography>
              NOTE: this will create new session tracks with the "filter by" set
              to the values chosen here rather than affecting the current track
              state
            </Typography>
            <Typography color="textSecondary">
              Examples: HP for haplotype, RG for read group, etc.
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeUndefined}
                  onChange={() => {
                    setIncludeUndefined(!includeUndefined)
                  }}
                />
              }
              label="Make a new subtrack for undefined values of tag as well?"
            />
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
              <LoadingEllipses title="Loading unique tags" />
            ) : tagSet ? (
              <div>
                <div>Found unique {tag} values:</div>
                <div>{tagSet.join(', ')}</div>
              </div>
            ) : null}
          </>
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
            const track = getContainingTrack(model)
            const trackConf = clone(getSnapshot(track.configuration))
            const session = getSession(model)
            const view = getContainingView(model) as LinearGenomeViewModel
            if (type === 'tag') {
              if (tagSet) {
                const ret = [...tagSet] as (string | undefined)[]
                if (includeUndefined) {
                  ret.push(undefined)
                }
                for (const tagValue of ret) {
                  const t1 = `${trackConf.trackId}-${tag}:${tagValue}-${+Date.now()}-sessionTrack`
                  // @ts-expect-error
                  session.addTrackConf({
                    ...trackConf,
                    trackId: t1,
                    name: `${trackConf.name} (-)`,
                    displays: [
                      {
                        displayId: `${t1}-LinearAlignmentsDisplay`,
                        type: 'LinearAlignmentsDisplay',
                        pileupDisplay: {
                          displayId: `${t1}-LinearAlignmentsDisplay-LinearPileupDisplay`,
                          type: 'LinearPileupDisplay',
                          filterBy: {
                            ...defaultFilterFlags,
                            tagFilter: {
                              tag,
                              value: tagValue,
                            },
                          },
                        },
                      },
                    ],
                  })
                  view.showTrack(t1)
                }
              }
            } else if (type === 'strand') {
              const t1 = `${trackConf.trackId}-${tag}:(-)-${+Date.now()}-sessionTrack`
              const t2 = `${trackConf.trackId}-${tag}:(+)-${+Date.now()}-sessionTrack`
              // @ts-expect-error
              session.addTrackConf({
                ...trackConf,
                trackId: t1,
                name: `${trackConf.name} (-)`,
                displays: [
                  {
                    displayId: `${t1}-LinearAlignmentsDisplay`,
                    type: 'LinearAlignmentsDisplay',
                    pileupDisplay: {
                      displayId: `${t1}-LinearAlignmentsDisplay-LinearPileupDisplay`,
                      type: 'LinearPileupDisplay',
                      filterBy: {
                        flagInclude: 16,
                        flagExclude: 1540,
                      },
                    },
                  },
                ],
              })
              // @ts-expect-error
              session.addTrackConf({
                ...trackConf,
                trackId: t2,
                name: `${trackConf.name} (+)`,
                displays: [
                  {
                    displayId: `${t2}-LinearAlignmentsDisplay`,
                    type: 'LinearAlignmentsDisplay',
                    pileupDisplay: {
                      displayId: `${t2}-LinearAlignmentsDisplay-LinearPileupDisplay`,
                      type: 'LinearPileupDisplay',
                      filterBy: {
                        flagInclude: 0,
                        flagExclude: 1556,
                      },
                    },
                  },
                ],
              })
              view.showTrack(t1)
              view.showTrack(t2)
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
