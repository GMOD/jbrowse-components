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
  Radio,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import {
  READ_CATEGORIES,
  readCategoryChoice,
  setReadCategory,
} from '../../shared/readCategoryFilters.ts'
import { defaultFilterFlags } from '../../shared/util.ts'

import type {
  ReadCategoryChoice,
  ReadCategoryKey,
} from '../../shared/readCategoryFilters.ts'
import type { FilterBy } from '../../shared/types.ts'

// The three choices every read category offers, in one order, so the grid below
// is four rows under one set of column headings rather than four radio groups
// each restating its own options.
const CHOICES = [
  { value: 'all', heading: 'All' },
  { value: 'only', heading: 'Only' },
  { value: 'exclude', heading: 'Hide' },
] as const satisfies readonly { value: ReadCategoryChoice; heading: string }[]

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
  // Label column takes the slack; the three radio columns are only as wide as
  // their headings, so the radios line up in a scannable stack.
  categoryGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr repeat(3, auto)',
    alignItems: 'center',
    columnGap: theme.spacing(2),
  },
  // Same shape, two columns: one row per flag rather than the flag list twice.
  flagGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr repeat(2, auto)',
    alignItems: 'center',
    columnGap: theme.spacing(2),
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
  const { classes } = useStyles()
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
        <div className={classes.flagGrid}>
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

// The four read categories as one grid: four rows under one All/Only/Hide
// heading, driven by READ_CATEGORIES so this and the track menu offer the same
// four filters in the same order.
//
// Plain `Radio`s sharing a `name` per row rather than a MUI `RadioGroup`: the
// group wrapper is a flex container, which would break each row out of the grid
// and lose the column alignment that makes the four readable together. A shared
// `name` is what actually makes them one group to the browser and to the
// keyboard.
function ReadCategorySection(props: {
  categories: Record<ReadCategoryKey, ReadCategoryChoice>
  setCategory: (key: ReadCategoryKey, choice: ReadCategoryChoice) => void
}) {
  const { classes } = useStyles()
  const { categories, setCategory } = props
  return (
    <Paper className={classes.paper} variant="outlined">
      <Typography>Read categories</Typography>
      <div className={classes.categoryGrid}>
        <span />
        {CHOICES.map(({ heading }) => (
          <Typography
            key={heading}
            variant="caption"
            className={classes.heading}
          >
            {heading}
          </Typography>
        ))}
        {READ_CATEGORIES.map(({ key, noun, helpText }) => (
          <Fragment key={key}>
            <label title={helpText}>{noun}</label>
            {CHOICES.map(({ value, heading }) => (
              <Radio
                key={value}
                size="small"
                name={key}
                className={classes.checkbox}
                checked={categories[key] === value}
                onChange={() => {
                  setCategory(key, value)
                }}
                slotProps={{ input: { 'aria-label': `${noun}: ${heading}` } }}
              />
            ))}
          </Fragment>
        ))}
      </div>
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

function initialCategories(filterBy: FilterBy) {
  return Object.fromEntries(
    READ_CATEGORIES.map(c => [c.key, readCategoryChoice(filterBy, c.key)]),
  ) as Record<ReadCategoryKey, ReadCategoryChoice>
}

const ALL_CATEGORIES = Object.fromEntries(
  READ_CATEGORIES.map(c => [c.key, 'all']),
) as Record<ReadCategoryKey, ReadCategoryChoice>

// Sections in the order a user reaches for them: the read categories are the
// everyday filter, a read name or tag is the targeted one, and the flag masks
// are the expert control that used to open the dialog and outweigh the rest of
// it put together.
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
  const [categories, setCategories] = useState(() =>
    initialCategories(filterBy),
  )
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
    setCategories(ALL_CATEGORIES)
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
    const base: FilterBy = {
      flagInclude,
      flagExclude,
      // An empty field means "no read-name filter", so omit it rather than
      // storing ''. Consumers test `readName !== undefined` to decide whether a
      // filter is active (the context menu's "Clear read/tag filters"), and ''
      // would also change `filterBy` identity and trigger a pointless refetch.
      readName: readName === '' ? undefined : readName,
      tagFilters: tagFilters.length > 0 ? tagFilters : undefined,
    }
    // Through `setReadCategory` so the 'all' -> absent mapping is written once,
    // here and in the track menu alike.
    model.setFilterBy(
      READ_CATEGORIES.reduce(
        (acc, c) => setReadCategory(acc, c.key, categories[c.key]),
        base,
      ),
    )
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
          <ReadCategorySection
            categories={categories}
            setCategory={(key, choice) => {
              setCategories(prev => ({ ...prev, [key]: choice }))
            }}
          />
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
