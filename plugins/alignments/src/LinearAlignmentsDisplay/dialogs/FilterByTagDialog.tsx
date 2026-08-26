import { Fragment, useState } from 'react'

import { samFlagDescriptions, samFlagLabels } from '@jbrowse/cigar-utils'
import { Dialog, TagTextField } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Button,
  Checkbox,
  Collapse,
  DialogActions,
  DialogContent,
  Link,
  Paper,
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
  // `auto` for the label column and `justifyContent: start`, NOT `1fr`: a
  // fraction hands it every spare pixel of the dialog, which put ~450px of
  // whitespace between "read paired" and the box that answers for it — the
  // wide-table problem, where the eye loses the row on the way across. Sizing
  // to the longest label keeps each row readable as one line.
  grid: {
    display: 'grid',
    alignItems: 'center',
    justifyContent: 'start',
    columnGap: theme.spacing(2),
  },
  flagGrid: {
    gridTemplateColumns: 'auto repeat(2, auto)',
  },
  heading: {
    textAlign: 'center',
  },
  maskRow: {
    display: 'flex',
    gap: theme.spacing(2),
    margin: theme.spacing(1, 0),
  },
  checkbox: {
    margin: 0,
    padding: theme.spacing(0.25),
    justifySelf: 'center',
  },
  sectionButton: {
    justifyContent: 'flex-start',
    textTransform: 'none',
  },
}))

function toggleBit(flag: number, index: number, checked: boolean) {
  return checked ? flag | (1 << index) : flag & ~(1 << index)
}

function MaskField(props: {
  label: string
  flag: number
  setFlag: (arg: number) => void
}) {
  const { label, flag, setFlag } = props
  return (
    <TextField
      label={label}
      size="small"
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
  )
}

// One row per SAM flag with a Require and an Exclude box, rather than two
// twelve-checkbox columns each captioned with a sentence. Half the height, the
// flag named once, and the contradiction a user can otherwise build without
// noticing — the same flag required AND excluded, which empties the track — is
// now two ticks on one line.
function FlagFilterSection(props: {
  flagInclude: number
  flagExclude: number
  setFlagInclude: (arg: number) => void
  setFlagExclude: (arg: number) => void
}) {
  const { classes, cx } = useStyles()
  const { flagInclude, flagExclude, setFlagInclude, setFlagExclude } = props
  const atDefault =
    flagInclude === defaultFilterFlags.flagInclude &&
    flagExclude === defaultFilterFlags.flagExclude
  // Open when it is doing something beyond the default. The masks are the
  // dialog's expert control and its tallest section, so it stays out of the way
  // of the fields above until a track is actually filtered by one.
  const [open, setOpen] = useState(!atDefault)
  const site = 'https://broadinstitute.github.io/picard/explain-flags.html'

  return (
    <Paper className={classes.paper} variant="outlined">
      <Button
        fullWidth
        color="inherit"
        className={classes.sectionButton}
        endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        onClick={() => {
          setOpen(!open)
        }}
      >
        SAM flags
      </Button>
      <Collapse in={open}>
        <Typography variant="body2">
          A read must have every Require flag and none of the Exclude flags.
          Refer to <Link href={site}>{site}</Link> for details.
        </Typography>
        <div className={classes.maskRow}>
          <MaskField
            label="Require mask"
            flag={flagInclude}
            setFlag={setFlagInclude}
          />
          <MaskField
            label="Exclude mask"
            flag={flagExclude}
            setFlag={setFlagExclude}
          />
        </div>
        <div className={cx(classes.grid, classes.flagGrid)}>
          <span />
          <Typography variant="caption" className={classes.heading}>
            Require
          </Typography>
          <Typography variant="caption" className={classes.heading}>
            Exclude
          </Typography>
          {samFlagLabels.map((name, index) => (
            <Fragment key={name}>
              <label title={samFlagDescriptions[index]}>{name}</label>
              <Checkbox
                size="small"
                className={classes.checkbox}
                checked={Boolean(flagInclude & (1 << index))}
                onChange={event => {
                  setFlagInclude(
                    toggleBit(flagInclude, index, event.target.checked),
                  )
                }}
                slotProps={{ input: { 'aria-label': `Require ${name}` } }}
              />
              <Checkbox
                size="small"
                className={classes.checkbox}
                checked={Boolean(flagExclude & (1 << index))}
                onChange={event => {
                  setFlagExclude(
                    toggleBit(flagExclude, index, event.target.checked),
                  )
                }}
                slotProps={{ input: { 'aria-label': `Exclude ${name}` } }}
              />
            </Fragment>
          ))}
        </div>
      </Collapse>
    </Paper>
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
        size="small"
        value={readName}
        placeholder="Enter read name"
        onChange={event => {
          setReadName(event.target.value)
        }}
      />
    </Paper>
  )
}

// The filters a user TYPES: a read name, a tag and its value, and the flag
// masks. The four read categories are picked off a list instead, so they are
// rows in the "Filter by..." submenu and are deliberately not repeated here —
// one control, one home, and one commitment model. Offering them in both places
// meant the same filter applied on click in the menu and only on Submit here,
// with Cancel undoing one and not the other.
//
// Which is also why this dialog's Submit and Reset touch only the three fields
// below: everything it does not show, it preserves. The menu's "Clear all
// filters" is what resets the whole of `filterBy`.
//
// Sections run in the order a user reaches for them, the flag masks last —
// they used to open the dialog and outweigh the rest of it put together.
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
      // Spread first: the read categories live in `filterBy` too and are edited
      // from the track menu, so a Submit here must carry them through rather
      // than rebuild the object from what this dialog happens to show.
      ...filterBy,
      flagInclude,
      flagExclude,
      // An empty field means "no read-name filter", so omit it rather than
      // storing ''. Consumers test `readName !== undefined` to decide whether a
      // filter is active (the context menu's "Clear read/tag filters"), and ''
      // would also change `filterBy` identity and trigger a pointless refetch.
      readName: readName === '' ? undefined : readName,
      tagFilters: tagFilters.length > 0 ? tagFilters : undefined,
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
          <ReadNameFilterSection
            readName={readName}
            setReadName={setReadName}
          />
          <TagFilterSection
            key={resetNonce}
            tag={tag}
            tagValue={tagValue}
            setTag={setTag}
            setTagValue={setTagValue}
          />
          <FlagFilterSection
            flagInclude={flagInclude}
            flagExclude={flagExclude}
            setFlagInclude={setFlagInclude}
            setFlagExclude={setFlagExclude}
          />
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
