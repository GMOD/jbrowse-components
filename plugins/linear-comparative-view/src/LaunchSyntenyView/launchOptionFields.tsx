import { LabeledCheckbox, NumberTextField } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { HelpTooltip } from '@jbrowse/synteny-core'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
} from '@mui/material'

import type { ReactNode } from 'react'

// The option fields the launch dialogs carry: the pairwise launch (one clicked
// alignment) and the region launch (every assembly a locus aligns to) ask the
// same questions, so they ask them in the same words. The panel-collapse box is
// only offered by the region launch, where a stack of rows is what makes the
// per-row empty-state block expensive.
export const DEFAULT_WINDOW_SIZE = 1000

const useStyles = makeStyles()(theme => ({
  formControl: {
    margin: 10,
    border: '1px solid #ccc',
  },
  // Flattened out of MUI's default Accordion, which is a Paper: in a dialog the
  // elevation and the ::before divider read as a second dialog inside the
  // first. The SUMMARY's teal is deliberately left alone — the theme paints
  // every `MuiAccordionSummary` with `palette.tertiary.main`
  // (packages/core/src/ui/theme.ts), which is how a section header looks
  // everywhere else in the app, and it is what makes this row read as a control
  // rather than as a line of text.
  advanced: {
    background: 'none',
    '&:before': {
      display: 'none',
    },
  },
  advancedSummary: {
    minHeight: 0,
    padding: theme.spacing(0, 1),
    '& .MuiAccordionSummary-content': {
      margin: theme.spacing(0.5, 0),
    },
  },
  // The expand chevron inherits the default text colour, which on that teal is
  // near-invisible — the same override AboutWidget's accordions carry. Missing
  // it is how the first cut of this shipped a header with no affordance on it
  // at all, plainly visible in multiway_synteny/ecoli_launch_dialog.
  advancedIcon: {
    color: theme.palette.tertiary.contrastText || '#fff',
  },
  advancedDetails: {
    padding: 0,
  },
}))

// The tail of the region launch dialog, folded away (review: "can the dialog
// y-screen real estate be improved by potentially adding an 'advanced'
// dropdown?"). Every field inside has a working default, and the thing the
// dialog is FOR -- the panel list, one row per aligning assembly, which the
// user reorders and unchecks -- is above it. On an all-vs-all locus that list
// is a dozen rows and scrolls, so the options below it were what decided how
// much of the list a short window could show.
//
// Only the region launch gets one. The pairwise dialog's whole body is these
// same fields, two or three of them depending on the alignment, so folding them
// there would leave a dialog with nothing in it but a submit button.
//
// Collapsed rather than `defaultExpanded`: an option a reader has to open is
// still discoverable, and each of these was already reachable only by knowing
// the dialog. The children stay mounted, so the fields' own state is the
// dialog's whether or not it is ever opened.
export function AdvancedLaunchOptions({ children }: { children: ReactNode }) {
  const { classes } = useStyles()
  return (
    <Accordion disableGutters elevation={0} className={classes.advanced}>
      <AccordionSummary
        expandIcon={
          <ExpandMoreIcon fontSize="small" className={classes.advancedIcon} />
        }
        className={classes.advancedSummary}
      >
        <Typography variant="subtitle2">Advanced</Typography>
      </AccordionSummary>
      <AccordionDetails className={classes.advancedDetails}>
        {children}
      </AccordionDetails>
    </Accordion>
  )
}

export interface LaunchOptionProps {
  checked: boolean
  onChange: (checked: boolean) => void
}

// The shape every option below is: one boxed, compact checkbox whose label is
// the whole of what it says, plus a tooltip carrying the "why". Written once so
// each option is its own words and nothing else.
function LaunchCheckbox({
  checked,
  onChange,
  label,
  help,
}: LaunchOptionProps & { label: string; help?: string }) {
  const { classes } = useStyles()
  return (
    <LabeledCheckbox
      className={classes.formControl}
      size="small"
      checked={checked}
      onChange={val => {
        onChange(val)
      }}
      label={
        help ? (
          <span>
            {label} <HelpTooltip help={help} />
          </span>
        ) : (
          label
        )
      }
    />
  )
}

// Narrow both panels to the slice of the alignment the user is looking at,
// rather than framing them on the whole block's endpoints. Offered by the
// pairwise launch, where the clicked block can be far wider than the view.
//
// Two labels because the two ways of resolving that slice are worth telling
// apart: with a CIGAR the alignment is walked base by base, and without one the
// block is interpolated across — which is all its straight ribbon claims anyway,
// but is an estimate rather than a mapping and shouldn't be worded as one.
export function ClipToRegionCheckbox({
  hasCigar,
  ...props
}: LaunchOptionProps & { hasCigar: boolean }) {
  return hasCigar ? (
    <LaunchCheckbox
      {...props}
      label="Use CIGAR to map the current visible region to the target"
    />
  ) : (
    <LaunchCheckbox
      {...props}
      label="Clip the panels to the current visible region"
      help="This alignment carries no CIGAR, so the matching interval on the target is estimated by interpolating across the block — the same straight line its ribbon is drawn as"
    />
  )
}

export function FlipInvertedTargetsCheckbox(props: LaunchOptionProps) {
  return (
    <LaunchCheckbox
      {...props}
      label="Horizontally flip inverted targets"
      // the "why" is a tooltip rather than two wrapped lines of dialog: an
      // unflipped inverted panel runs right to left, which is what the reader
      // needs on demand, not permanently
      help="Without flipping, an inverted panel's coordinates decrease left to right"
    />
  )
}

// The launching view's own tracks, carried onto the panel for its assembly (see
// anchorPanelTracks). On by default — it is the state the user is already
// looking at, and the alternative is reopening those tracks by hand in a panel
// that just opened blank — but it is a checkbox rather than unconditional
// because the copy costs a second fetch of everything open, which is a real
// price when what's open is a BAM.
export function CopySourceTracksCheckbox(props: LaunchOptionProps) {
  return (
    <LaunchCheckbox
      {...props}
      label="Copy this view's tracks into its panel"
      help="The panel for the assembly you launched from opens with the tracks open here; the other panels open empty, since nothing here says what they should show"
    />
  )
}

// A mate panel gets no tracks, so every such row would open on the ~90px "No
// tracks active / Open track selector" block — on a five-row stack more of the
// viewport than the ribbons the launch was for. Collapsed to rulers by default,
// with this to opt out; a row also expands from its own MiniControls afterwards.
// A row that has tracks (the anchor, when the copy above is on) is unaffected.
export function CollapsePanelsCheckbox(props: LaunchOptionProps) {
  return (
    <LaunchCheckbox
      {...props}
      label="Collapse panels to rulers"
      help="Each genome row opens as just its ruler until you add tracks to it; expand a row from its own controls at any time"
    />
  )
}

// Padding added to both sides of every launched panel. `undefined` is a cleared
// or invalid field, which the dialogs turn into a disabled Submit rather than
// silently launching on the default. Labelled for what it does to the panels
// rather than as "Add window size in bp", which read as an instruction with its
// object missing and named a quantity nothing else in the dialog mentions.
//
// Inline-level, like the checkboxes above it, so with an odd number of them it
// shares the last one's line as a second column. Checked at full resolution in
// genomes_synteny/launch_sequence's dialog frame: it reads as a labelled field
// of its own there, so it is left flowing rather than forced onto a new row.
export function WindowSizeField({
  onChange,
}: {
  onChange: (windowSize: number | undefined) => void
}) {
  return (
    <NumberTextField
      label="Padding around each panel (bp)"
      defaultValue={DEFAULT_WINDOW_SIZE}
      onValueChange={val => {
        onChange(val)
      }}
      min={0}
      errorText="Must be a non-negative number"
    />
  )
}
