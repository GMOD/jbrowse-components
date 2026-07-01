import { useState } from 'react'

import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import { observer } from 'mobx-react'

const useStyles = makeStyles()(theme => ({
  legend: {
    position: 'absolute',
    right: 10,
    top: 10,
    background: theme.palette.background.paper,
    padding: 3,
    fontSize: 10,
    zIndex: 100,
    maxWidth: 200,
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  withClose: {
    paddingRight: 20,
  },
  section: {
    '&:not(:last-child)': {
      marginBottom: 4,
    },
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 2,
  },
  sectionTitle: {
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  sectionClose: {
    padding: 0,
    marginLeft: 2,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 1,
    '&:last-child': {
      marginBottom: 0,
    },
  },
  colorBox: {
    width: 12,
    height: 12,
    marginRight: 6,
    flexShrink: 0,
  },
  label: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  toggle: {
    cursor: 'pointer',
    marginTop: 2,
    display: 'block',
    fontSize: 10,
  },
}))

const DEFAULT_MAX_ITEMS = 12

export interface LegendItem {
  color?: string
  label: string
}

export interface LegendSection {
  id: string
  title?: string
  items: LegendItem[]
}

// One list of swatches with its own independent collapse state, so each section
// in a multi-section legend expands/collapses on its own.
const LegendItemList = observer(function LegendItemList({
  items,
  maxItems,
}: {
  items: LegendItem[]
  maxItems: number
}) {
  const { classes } = useStyles()
  const [expanded, setExpanded] = useState(false)
  const collapsible = items.length > maxItems
  const shown = collapsible && !expanded ? items.slice(0, maxItems) : items
  const hiddenCount = items.length - maxItems
  return (
    <>
      {shown.map((item, i) => (
        <div key={`${item.label}-${i}`} className={classes.item}>
          <div
            className={classes.colorBox}
            style={{ backgroundColor: item.color }}
          />
          <span className={classes.label}>{item.label}</span>
        </div>
      ))}
      {collapsible ? (
        <Link
          component="button"
          underline="hover"
          className={classes.toggle}
          onClick={() => {
            setExpanded(!expanded)
          }}
        >
          {expanded ? 'Show less' : `Show ${hiddenCount} more…`}
        </Link>
      ) : null}
    </>
  )
})

// Floating color-key overlay. Pass a flat `items` list for a single scheme, or
// `sections` to show several titled, individually-closable panels in one box
// (e.g. genotype colors vs. sample-grouping colors on the multi-sample variant
// display). Section titles + per-section close buttons only appear when there
// is more than one section, so a single-scheme legend looks unchanged.
const FloatingLegend = observer(function FloatingLegend({
  items,
  sections,
  onDismiss,
  onDismissSection,
  maxItems = DEFAULT_MAX_ITEMS,
}: {
  items?: LegendItem[]
  sections?: LegendSection[]
  onDismiss?: () => void
  onDismissSection?: (id: string) => void
  maxItems?: number
}) {
  const { classes } = useStyles()

  const allSections = sections ?? (items ? [{ id: '', items }] : [])
  const nonEmpty = allSections.filter(s => s.items.length > 0)
  if (nonEmpty.length === 0) {
    return null
  }

  const multiSection = nonEmpty.length > 1
  return (
    <div className={cx(classes.legend, onDismiss && classes.withClose)}>
      {onDismiss ? (
        <IconButton
          className={classes.closeButton}
          size="small"
          title="Hide legend"
          onClick={() => {
            onDismiss()
          }}
        >
          <CloseIcon fontSize="inherit" />
        </IconButton>
      ) : null}
      {nonEmpty.map(section => (
        <div key={section.id} className={classes.section}>
          {multiSection && section.title ? (
            <div className={classes.sectionHeader}>
              <span className={classes.sectionTitle}>{section.title}</span>
              {onDismissSection ? (
                <IconButton
                  className={classes.sectionClose}
                  size="small"
                  title={`Hide ${section.title}`}
                  onClick={() => {
                    onDismissSection(section.id)
                  }}
                >
                  <CloseIcon fontSize="inherit" />
                </IconButton>
              ) : null}
            </div>
          ) : null}
          <LegendItemList items={section.items} maxItems={maxItems} />
        </div>
      ))}
    </div>
  )
})

export default FloatingLegend
