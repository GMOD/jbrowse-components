import { useState } from 'react'

import { samFlagLabels } from '@jbrowse/alignments-core'
import { Dialog, TagTextField } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  Link,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { COMMON_READ_TAGS } from '../../shared/commonTags.ts'
import { defaultFilterFlags } from '../../shared/util.ts'

import type { FilterBy } from '../../shared/types.ts'

const useStyles = makeStyles()(theme => ({
  paper: {
    padding: theme.spacing(2),
    margin: theme.spacing(2),
  },
  field: {
    margin: theme.spacing(2),
  },
  flagContainer: {
    display: 'flex',
    gap: theme.spacing(4),
  },
  flagRow: {
    display: 'flex',
    alignItems: 'center',
  },
  checkbox: {
    margin: 0,
    padding: 0,
  },
}))

function toggleBit(flag: number, index: number, checked: boolean) {
  return checked ? flag | (1 << index) : flag & ~(1 << index)
}

function Bitmask(props: { flag?: number; setFlag: (arg: number) => void }) {
  const { flag = 0, setFlag } = props
  const { classes } = useStyles()
  return (
    <>
      <TextField
        value={flag}
        onChange={event => {
          const n = Number(event.target.value)
          if (Number.isFinite(n) && n >= 0) {
            setFlag(n)
          }
        }}
      />
      {samFlagLabels.map((name, index) => {
        const checked = Boolean(flag & (1 << index))
        return (
          <div key={name} className={classes.flagRow}>
            <Checkbox
              checked={checked}
              onChange={event => {
                setFlag(toggleBit(flag, index, event.target.checked))
              }}
              slotProps={{
                input: {
                  id: `flag_${index}`,
                },
              }}
              size="small"
              className={classes.checkbox}
            />
            <label htmlFor={`flag_${index}`}>{name}</label>
          </div>
        )
      })}
    </>
  )
}

function FlagFilterSection(props: {
  flagInclude: number
  flagExclude: number
  setFlagInclude: (arg: number) => void
  setFlagExclude: (arg: number) => void
}) {
  const { classes } = useStyles()
  const { flagInclude, flagExclude, setFlagInclude, setFlagExclude } = props

  const site = 'https://broadinstitute.github.io/picard/explain-flags.html'

  return (
    <>
      <Typography>
        Set filter bitmask options. Refer to <Link href={site}>{site}</Link> for
        details
      </Typography>
      <Paper className={classes.paper} variant="outlined">
        <div className={classes.flagContainer}>
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
    </>
  )
}

function TagFilterSection(props: {
  tag: string
  tagValue: string
  setTag: (arg: string) => void
  setTagValue: (arg: string) => void
}) {
  const { classes } = useStyles()
  const { tag, tagValue, setTag, setTagValue } = props

  return (
    <Paper className={classes.paper} variant="outlined">
      <Typography>Filter by tag name and value</Typography>
      <div className={classes.field}>
        <TagTextField
          defaultValue={tag}
          quickPicks={COMMON_READ_TAGS}
          onValueChange={value => {
            setTag(value ?? '')
          }}
        />
      </div>
      <TextField
        className={classes.field}
        label="Tag value"
        value={tagValue}
        placeholder="Enter value or * for any"
        helperText="Use * to match any value for the tag"
        onChange={event => {
          setTagValue(event.target.value)
        }}
      />
    </Paper>
  )
}

function ReadNameFilterSection(props: {
  readName: string
  setReadName: (arg: string) => void
}) {
  const { classes } = useStyles()
  const { readName, setReadName } = props

  return (
    <Paper className={classes.paper} variant="outlined">
      <Typography>Filter by read name</Typography>
      <TextField
        className={classes.field}
        value={readName}
        placeholder="Enter read name"
        onChange={event => {
          setReadName(event.target.value)
        }}
      />
    </Paper>
  )
}

const FilterByTagDialog = observer(function FilterByTagDialog(props: {
  model: {
    filterBy: FilterBy
    setFilterBy: (arg: FilterBy) => void
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const { filterBy } = model
  const [flagInclude, setFlagInclude] = useState(filterBy.flagInclude)
  const [flagExclude, setFlagExclude] = useState(filterBy.flagExclude)
  const [tag, setTag] = useState(filterBy.tagFilters?.[0]?.tag ?? '')
  const [tagValue, setTagValue] = useState(filterBy.tagFilters?.[0]?.value ?? '')
  // Additional tag filters (e.g. HP/RG set from the right-click quick filters)
  // aren't shown in this single-tag editor; preserve them across a submit so
  // opening this dialog to tweak a flag doesn't drop them.
  const [otherTagFilters, setOtherTagFilters] = useState(
    filterBy.tagFilters?.slice(1) ?? [],
  )
  const [readName, setReadName] = useState(filterBy.readName ?? '')

  const handleReset = () => {
    setFlagInclude(defaultFilterFlags.flagInclude)
    setFlagExclude(defaultFilterFlags.flagExclude)
    setTag('')
    setTagValue('')
    setOtherTagFilters([])
    setReadName('')
  }

  const handleSubmit = () => {
    const tagFilters = [
      ...(tag !== '' ? [{ tag, value: tagValue }] : []),
      ...otherTagFilters,
    ]
    model.setFilterBy({
      flagInclude,
      flagExclude,
      readName,
      tagFilters: tagFilters.length > 0 ? tagFilters : undefined,
    })
    handleClose()
  }

  return (
    <Dialog open onClose={handleClose} title="Filter options">
      <DialogContent>
        <FlagFilterSection
          flagInclude={flagInclude}
          flagExclude={flagExclude}
          setFlagInclude={setFlagInclude}
          setFlagExclude={setFlagExclude}
        />
        <TagFilterSection
          tag={tag}
          tagValue={tagValue}
          setTag={setTag}
          setTagValue={setTagValue}
        />
        <ReadNameFilterSection readName={readName} setReadName={setReadName} />
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={handleReset}>
          Reset defaults
        </Button>
        <Button
          variant="contained"
          color="primary"
          autoFocus
          type="submit"
          onClick={handleSubmit}
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

export default FilterByTagDialog
