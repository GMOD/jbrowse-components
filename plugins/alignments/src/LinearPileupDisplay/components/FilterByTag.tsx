import React, { useState } from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Paper,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core'

import CloseIcon from '@material-ui/icons/Close'

const useStyles = makeStyles(theme => ({
  root: {
    width: 500,
  },
  paper: {
    padding: theme.spacing(2),
    margin: theme.spacing(2),
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
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

function Bitmask(props: { flag?: number; setFlag: Function }) {
  const { flag = 0, setFlag } = props
  return (
    <>
      <TextField
        type="number"
        value={flag}
        onChange={event => setFlag(+event.target.value)}
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

function FilterByTagDlg(props: {
  model: {
    filterBy?: {
      flagExclude: number
      flagInclude: number
      readName?: string
      tagFilter?: { tag: string; value: string }
    }
    setFilterBy: Function
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const classes = useStyles()
  const { filterBy } = model
  const [flagInclude, setFlagInclude] = useState(filterBy?.flagInclude)
  const [flagExclude, setFlagExclude] = useState(filterBy?.flagExclude)
  const [tag, setTag] = useState(filterBy?.tagFilter?.tag || '')
  const [tagValue, setTagValue] = useState(filterBy?.tagFilter?.value || '')
  const [readName, setReadName] = useState(filterBy?.readName || '')
  const validTag = tag.match(/^[A-Za-z][A-Za-z0-9]$/)

  const site = 'https://broadinstitute.github.io/picard/explain-flags.html'

  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle>
        Filter options
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography>
          Set filter bitmask options. Refer to <Link href={site}>{site}</Link>{' '}
          for details
        </Typography>
        <div className={classes.root}>
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
              reads containing any value for that tag. Example: filter tag name
              SA with value * to get all split/supplementary reads. Other
              examples include HP for haplotype, or RG for read group
            </Typography>
            <TextField
              className={classes.field}
              value={tag}
              onChange={event => {
                setTag(event.target.value)
              }}
              placeholder="Enter tag name"
              inputProps={{
                maxLength: 2,
                'data-testid': 'color-tag-name-input',
              }}
              error={tag.length === 2 && !validTag}
              helperText={
                tag.length === 2 && !validTag ? 'Not a valid tag' : ''
              }
              data-testid="color-tag-name"
            />
            <TextField
              className={classes.field}
              value={tagValue}
              onChange={event => {
                setTagValue(event.target.value)
              }}
              placeholder="Enter tag value"
              inputProps={{
                'data-testid': 'color-tag-name-input',
              }}
              data-testid="color-tag-value"
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
              inputProps={{
                'data-testid': 'color-tag-readname-input',
              }}
              data-testid="color-tag-readname"
            />
          </Paper>
          <Button
            variant="contained"
            color="primary"
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
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default observer(FilterByTagDlg)
