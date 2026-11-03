import { useState } from 'react'

import ExpandMore from '@mui/icons-material/ExpandMore'
import {
  ButtonBase,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material'
import { observer } from 'mobx-react'

import ActionLink from '../../ui/ActionLink.tsx'
import PluggableComponents from '../../ui/PluggableComponents.tsx'
import { getEnv, toLocale } from '../../util/index.ts'
import { makeStyles } from '../../util/tss-react/index.ts'
import Attributes, { hasAttributeRows } from './Attributes.tsx'
import { ValueText } from './BasicValue.tsx'
import {
  cdsLength,
  omittedForMember,
  subfeatureGroups,
  subfeatureSummary,
} from './subfeatureGrouping.ts'

import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type {
  Descriptors,
  FeatureDetailsModel,
  FeatureFormatter,
} from '../types.tsx'
import type { SubfeatureGroup, SubfeatureMember } from './subfeatureGrouping.ts'

const useStyles = makeStyles()(theme => ({
  disclosure: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    width: '100%',
    justifyContent: 'flex-start',
    padding: theme.spacing(0.5, 0),
    fontSize: 13,
    fontWeight: 500,
  },
  chevron: {
    fontSize: 18,
    transition: 'transform 150ms',
  },
  closed: {
    transform: 'rotate(-90deg)',
  },
  count: {
    color: theme.palette.text.secondary,
    fontWeight: 400,
  },
  group: {
    paddingLeft: theme.spacing(1),
    overflowX: 'auto',
  },
  table: {
    '& th, & td': {
      fontSize: 12,
      padding: theme.spacing(0.25, 1),
    },
    '& th': {
      color: theme.palette.text.secondary,
    },
  },
  openable: {
    cursor: 'pointer',
    '&:hover': {
      background: theme.palette.action.hover,
    },
  },
  nowrap: {
    whiteSpace: 'nowrap',
  },
  summary: {
    color: theme.palette.text.secondary,
    fontSize: 11,
  },
  details: {
    paddingLeft: theme.spacing(2),
    paddingBottom: theme.spacing(1),
  },
}))

interface SharedProps {
  model: FeatureDetailsModel
  depth: number
  locate?: (feature: SimpleFeatureSerialized) => (() => void) | undefined
  descriptions?: Descriptors
  formatter?: FeatureFormatter
  omit?: string[]
}

const Disclosure = observer(function Disclosure({
  open,
  onToggle,
  children,
}: {
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const { classes, cx } = useStyles()
  return (
    <ButtonBase
      className={classes.disclosure}
      aria-expanded={open}
      onClick={() => {
        onToggle()
      }}
    >
      <ExpandMore className={cx(classes.chevron, !open && classes.closed)} />
      {children}
    </ButtonBase>
  )
})

/**
 * A member's own detail under its row: what it carries that neither the row,
 * the group's shared attributes nor its parent already says, any plugin
 * panels, and its own subfeatures grouped the same way.
 */
const MemberDetails = observer(function MemberDetails({
  member,
  group,
  parent,
  ...props
}: SharedProps & {
  member: SubfeatureMember
  group: SubfeatureGroup
  parent: SimpleFeatureSerialized
}) {
  const { model, depth, descriptions, formatter, omit = [] } = props
  const { feature, unformatted } = member
  return (
    <>
      <Attributes
        attributes={feature}
        omit={omit}
        omitSingleLevel={omittedForMember(feature, group, parent)}
        descriptions={descriptions}
        formatter={formatter}
      />
      <PluggableComponents
        pluginManager={getEnv(model).pluginManager}
        name="Core-extraFeaturePanel"
        props={{ model, feature, unformatted, depth }}
      />
      <SubfeatureGroups
        {...props}
        feature={feature}
        unformatted={unformatted}
      />
    </>
  )
})

const MemberRow = observer(function MemberRow({
  member,
  group,
  parent,
  index,
  columns,
  ...props
}: SharedProps & {
  member: SubfeatureMember
  group: SubfeatureGroup
  parent: SimpleFeatureSerialized
  index: number
  columns: { name: boolean; openable: boolean }
}) {
  const { classes, cx } = useStyles()
  const [open, setOpen] = useState(false)
  const { feature } = member
  const { locate, depth, omit = [] } = props
  const openable =
    columns.openable ||
    !!feature.subfeatures?.length ||
    hasAttributeRows(feature, [
      ...omit,
      ...omittedForMember(feature, group, parent),
    ])
  const position = `${toLocale(feature.start + 1)}-${toLocale(feature.end)}`
  const go = locate?.(feature)
  const span = 4 + Number(columns.name)
  const label = feature.name ?? feature.id
  const summary = subfeatureSummary(feature)
  return (
    <>
      <TableRow
        className={cx(openable && classes.openable)}
        onClick={
          openable
            ? () => {
                setOpen(v => !v)
              }
            : undefined
        }
      >
        <TableCell>{index + 1}</TableCell>
        {columns.name ? (
          <TableCell>
            {label != null ? <ValueText text={String(label)} /> : null}
            {summary ? <div className={classes.summary}>{summary}</div> : null}
          </TableCell>
        ) : null}
        <TableCell className={classes.nowrap}>
          {go ? (
            <span
              onClick={e => {
                e.stopPropagation()
              }}
            >
              <ActionLink
                title="Show in view"
                onClick={() => {
                  go()
                }}
              >
                {position}
              </ActionLink>
            </span>
          ) : (
            position
          )}
        </TableCell>
        <TableCell align="right">
          {toLocale(feature.end - feature.start)}
        </TableCell>
        <TableCell padding="none">
          {openable ? (
            <IconButton
              size="small"
              aria-label={open ? 'Hide details' : 'Show details'}
              aria-expanded={open}
              onClick={e => {
                e.stopPropagation()
                setOpen(v => !v)
              }}
            >
              <ExpandMore
                className={cx(classes.chevron, !open && classes.closed)}
              />
            </IconButton>
          ) : null}
        </TableCell>
      </TableRow>
      {open ? (
        <TableRow>
          <TableCell colSpan={span} className={classes.details}>
            <MemberDetails
              {...props}
              depth={depth + 1}
              member={member}
              group={group}
              parent={parent}
            />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
})

const Group = observer(function Group({
  group,
  parent,
  defaultOpen,
  ...props
}: SharedProps & {
  group: SubfeatureGroup
  parent: SimpleFeatureSerialized
  defaultOpen: boolean
}) {
  const { classes } = useStyles()
  const [open, setOpen] = useState(defaultOpen)
  const { type, members, shared } = group
  const { model, descriptions, formatter } = props
  const isCds = type.toLowerCase() === 'cds'
  const columns = {
    name: members.some(
      ({ feature: f }) =>
        f.name != null || f.id != null || !!f.subfeatures?.length,
    ),
    openable:
      getEnv(model).pluginManager.extensionPointCallbackCount(
        'Core-extraFeaturePanel',
      ) > 0,
  }
  return (
    <div data-testid={`subfeature-group-${type}`}>
      <Disclosure
        open={open}
        onToggle={() => {
          setOpen(v => !v)
        }}
      >
        {type}
        <span className={classes.count}>
          {members.length}
          {isCds ? ` · ${toLocale(cdsLength(parent))} bp` : ''}
        </span>
      </Disclosure>
      {open ? (
        <div className={classes.group}>
          <Attributes
            attributes={shared}
            descriptions={descriptions}
            formatter={formatter}
          />
          <Table size="small" className={classes.table}>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                {columns.name ? <TableCell>Name</TableCell> : null}
                <TableCell>Position</TableCell>
                <TableCell align="right">Length</TableCell>
                <TableCell padding="none" />
              </TableRow>
            </TableHead>
            <TableBody>
              {members.map((member, index) => (
                <MemberRow
                  key={member.feature.uniqueId}
                  {...props}
                  member={member}
                  group={group}
                  parent={parent}
                  index={index}
                  columns={columns}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  )
})

/**
 * A feature's subfeatures, one group per type, each a table of its members
 * that open in place. A group opens by itself when it is the only one: a
 * gene's transcripts, but not a transcript's exons beside its CDS.
 */
const SubfeatureGroups = observer(function SubfeatureGroups({
  feature,
  unformatted,
  ...props
}: SharedProps & {
  feature: SimpleFeatureSerialized
  unformatted?: SimpleFeatureSerialized
}) {
  const groups = subfeatureGroups(feature, unformatted)
  const maxDepth = props.model.maxDepth ?? Infinity
  return props.depth < maxDepth
    ? groups.map(group => (
        <Group
          key={group.type}
          {...props}
          group={group}
          parent={feature}
          defaultOpen={groups.length === 1}
        />
      ))
    : null
})

export default SubfeatureGroups
