import React, { useState } from 'react'
import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  Link,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
// locals
import type { FilterBy } from '../types'

const useStyles = makeStyles()(theme => ({
  paper: {
    padding: theme.spacing(2),
    margin: theme.spacing(2),
  },
  field: {
    margin: theme.spacing(2),
  },
}))

const flagNames = [
  'read paired',
  'read mapped in proper pair',
  'read unmapped',
  'mate unmapped',
  'read reverse strand',
  'mate reverse strand',
  'first in pair',
  'second in pair',
  'not primary alignment',
  'read fails platform/vendor quality checks',
  'read is PCR or optical duplicate',
  'supplementary alignment',
]

function Bitmask(props: { flag?: number; setFlag: (arg: number) => void }) {
  const { flag = 0, setFlag } = props
  return (
    <>
      <TextField
        type="number"
        value={flag}
        onChange={event => {
          setFlag(+event.target.value)
        }}
      />
      {flagNames.map((name, index) => {
        const val = flag & (1 << index)
        const key = `${name}_${val}`
        return (
          <div key={key}>
            <input
              type="checkbox"
              checked={Boolean(val)}
              onChange={event => {
                if (event.target.checked) {
                  setFlag(flag | (1 << index))
                } else {
                  setFlag(flag & ~(1 << index))
                }
              }}
            />
            <label htmlFor={key}>{name}</label>
          </div>
        )
      })}
    </>
  )
}

const FilterByTagDialog = observer(function (props: {
  model: {
    filterBy: FilterBy
    setFilterBy: (arg: FilterBy) => void
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const { classes } = useStyles()
  const { filterBy } = model
  const [flagInclude, setFlagInclude] = useState(filterBy.flagInclude)
  const [flagExclude, setFlagExclude] = useState(filterBy.flagExclude)
  const [tag, setTag] = useState(filterBy.tagFilter?.tag || '')
  const [tagValue, setTagValue] = useState(filterBy.tagFilter?.value || '')
  const [readName, setReadName] = useState(filterBy.readName || '')
  const validTag = /^[A-Za-z][A-Za-z0-9]$/.exec(tag)

  const site = 'https://broadinstitute.github.io/picard/explain-flags.html'

  return (
    <Dialog open onClose={handleClose} title="Filter options">
      <DialogContent>
        <Typography>
          Set filter bitmask options. Refer to <Link href={site}>{site}</Link>{' '}
          for details
        </Typography>
        <Paper className={classes.paper} variant="outlined">
          <div style={{ display: 'flex' }}>
            <div>
              <Typography>Read must have ALL these flags</Typography>
              <Bitmask flag={flagInclude} setFlag={setFlagInclude} />
            </div>
            <div>
              <Typography>Read must have NONE of these flags</Typography>
              <Bitmask flag={flagExclude} setFlag={setFlagExclude} />
            </div>
          </div>
        </Paper>
        <Paper className={classes.paper} variant="outlined">
          <Typography>
            Filter by tag name and value. Use * in the value field to get all
            reads containing any value for that tag. Example: filter tag name SA
            with value * to get all split/supplementary reads. Other examples
            include HP for haplotype, or RG for read group
          </Typography>
          <TextField
            className={classes.field}
            value={tag}
            onChange={event => {
              setTag(event.target.value)
            }}
            placeholder="Enter tag name"
            error={tag.length === 2 && !validTag}
            helperText={tag.length === 2 && !validTag ? 'Not a valid tag' : ''}
            slotProps={{
              htmlInput: {
                maxLength: 2,
              },
            }}
          />
          <TextField
            className={classes.field}
            value={tagValue}
            onChange={event => {
              setTagValue(event.target.value)
            }}
            placeholder="Enter tag value"
          />
        </Paper>
        <Paper className={classes.paper} variant="outlined">
          <Typography>Filter by read name</Typography>
          <TextField
            className={classes.field}
            value={readName}
            onChange={event => {
              setReadName(event.target.value)
            }}
            placeholder="Enter read name"
          />
        </Paper>
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            autoFocus
            type="submit"
            onClick={() => {
              model.setFilterBy({
                flagInclude,
                flagExclude,
                readName,
                tagFilter:
                  tag !== ''
                    ? {
                        tag,
                        value: tagValue,
                      }
                    : undefined,
              })
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
      </DialogContent>
    </Dialog>
  )
})

export default FilterByTagDialog
