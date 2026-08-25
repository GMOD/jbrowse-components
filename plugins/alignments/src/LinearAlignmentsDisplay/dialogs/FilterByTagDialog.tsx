import { useState } from 'react'

import { samFlagLabels } from '@jbrowse/cigar-utils'
import { Dialog, TagTextField } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  Link,
  Paper,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { defaultFilterFlags } from '../../shared/util.ts'

import type { FilterBy } from '../../shared/types.ts'

const useStyles = makeStyles()(theme => ({
  paper: {
    padding: theme.spacing(1),
    margin: theme.spacing(1),
  },
  field: {
    margin: theme.spacing(1),
  },
  tagRow: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
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
          // Whole numbers only. `Number.isFinite` let "1.5" and "1e3" through:
          // the field then showed 1.5 while every `flag & (1 << i)` below read
          // it as 1, so the checkboxes and the number disagreed.
          const n = Number(event.target.value)
          if (Number.isInteger(n) && n >= 0) {
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
      <div className={classes.tagRow}>
        <TagTextField
          variant="outlined"
          size="small"
          defaultValue={tag}
          onValueChange={value => {
            setTag(value ?? '')
          }}
        />
        <TextField
          label="Tag value"
          variant="outlined"
          size="small"
          value={tagValue}
          placeholder="Enter value or * for any"
          onChange={event => {
            setTagValue(event.target.value)
          }}
        />
      </div>
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
        fullWidth
        variant="outlined"
        value={readName}
        placeholder="Enter read name"
        onChange={event => {
          setReadName(event.target.value)
        }}
      />
    </Paper>
  )
}

// The three-way choice is a radio group rather than two checkboxes because
// "only spliced" and "no spliced" cannot both hold, and 'all' is the absent
// filter rather than a stored value.
function SplicedFilterSection(props: {
  spliced: FilterBy['spliced']
  setSpliced: (arg: FilterBy['spliced']) => void
}) {
  const { classes } = useStyles()
  const { spliced, setSpliced } = props
  return (
    <Paper className={classes.paper} variant="outlined">
      <Typography>
        Filter by splicing (a reference skip, N, in the CIGAR)
      </Typography>
      <RadioGroup
        row
        value={spliced ?? 'all'}
        onChange={event => {
          const v = event.target.value
          setSpliced(v === 'only' || v === 'exclude' ? v : undefined)
        }}
      >
        <FormControlLabel value="all" control={<Radio />} label="All reads" />
        <FormControlLabel
          value="only"
          control={<Radio />}
          label="Only spliced reads"
        />
        <FormControlLabel
          value="exclude"
          control={<Radio />}
          label="Only unspliced reads"
        />
      </RadioGroup>
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
  const [tagValue, setTagValue] = useState(
    filterBy.tagFilters?.[0]?.value ?? '',
  )
  // Additional tag filters (e.g. HP/RG set from the right-click quick filters)
  // aren't shown in this single-tag editor; preserve them across a submit so
  // opening this dialog to tweak a flag doesn't drop them.
  const [otherTagFilters, setOtherTagFilters] = useState(
    filterBy.tagFilters?.slice(1) ?? [],
  )
  const [readName, setReadName] = useState(filterBy.readName ?? '')
  const [spliced, setSpliced] = useState(filterBy.spliced)
  // TagTextField is uncontrolled (seeds from defaultValue on mount), so clearing
  // `tag` state alone leaves its visible text stale. Bump this to remount it.
  const [resetNonce, setResetNonce] = useState(0)

  const handleReset = () => {
    setFlagInclude(defaultFilterFlags.flagInclude)
    setFlagExclude(defaultFilterFlags.flagExclude)
    setTag('')
    setTagValue('')
    setOtherTagFilters([])
    setReadName('')
    setSpliced(undefined)
    setResetNonce(nonce => nonce + 1)
  }

  const handleSubmit = () => {
    const tagFilters = [
      // A named tag with the value box left alone means "reads that carry this
      // tag", which is what `*` spells (see filterTagValue) — and what the
      // box's own placeholder offers. Storing the literal '' instead compared
      // every read's value against the empty string, so naming a tag and
      // tabbing straight to Submit emptied the track with nothing to say why.
      // A '' a config or session stored deliberately still means "the tag's
      // value is empty"; only what this dialog writes changes.
      ...(tag !== '' ? [{ tag, value: tagValue === '' ? '*' : tagValue }] : []),
      ...otherTagFilters,
    ]
    model.setFilterBy({
      flagInclude,
      flagExclude,
      // An empty field means "no read-name filter", so omit it rather than
      // storing ''. Consumers test `readName !== undefined` to decide whether a
      // filter is active (the context menu's "Clear read/tag filters"), and ''
      // would also change `filterBy` identity and trigger a pointless refetch.
      readName: readName === '' ? undefined : readName,
      tagFilters: tagFilters.length > 0 ? tagFilters : undefined,
      spliced,
    })
    handleClose()
  }

  return (
    <Dialog
      open
      onClose={() => {
        handleClose()
      }}
      title="Filter options"
    >
      {/* Form wrapper gives Enter-to-submit, like SubmitDialog. Reset/Cancel are
      MUI-default type="button" so they don't submit; only the primary does. */}
      <form
        onSubmit={event => {
          event.preventDefault()
          handleSubmit()
        }}
      >
        <DialogContent>
          <FlagFilterSection
            flagInclude={flagInclude}
            flagExclude={flagExclude}
            setFlagInclude={setFlagInclude}
            setFlagExclude={setFlagExclude}
          />
          <TagFilterSection
            key={resetNonce}
            tag={tag}
            tagValue={tagValue}
            setTag={setTag}
            setTagValue={setTagValue}
          />
          <ReadNameFilterSection
            readName={readName}
            setReadName={setReadName}
          />
          <SplicedFilterSection spliced={spliced} setSpliced={setSpliced} />
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            onClick={() => {
              handleReset()
            }}
          >
            Reset defaults
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
          <Button variant="contained" color="primary" autoFocus type="submit">
            Submit
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
})

export default FilterByTagDialog
