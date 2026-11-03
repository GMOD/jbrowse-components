import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'
import { observer } from 'mobx-react'

import ActionLink from '../../ui/ActionLink.tsx'
import { toLocale } from '../../util/index.ts'
import { makeStyles } from '../../util/tss-react/index.ts'
import Attributes from './Attributes.tsx'
import BaseCard from './BaseCard.tsx'
import { ValueText, valueText } from './BasicValue.tsx'

import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { Descriptors, FeatureFormatter } from '../types.tsx'
import type { PartsGroup } from './subfeatureGroups.ts'

const useStyles = makeStyles()(theme => ({
  table: {
    marginTop: theme.spacing(0.5),
    '& th, & td': {
      fontSize: 12,
      padding: theme.spacing(0.25, 1),
    },
    '& th': {
      color: theme.palette.text.secondary,
    },
  },
  position: {
    whiteSpace: 'nowrap',
  },
  followed: {
    '& td': {
      borderBottom: 'none',
    },
  },
  ownCell: {
    paddingTop: 0,
  },
  own: {
    display: 'flex',
    flexWrap: 'wrap',
    columnGap: theme.spacing(1.5),
    fontSize: 11,
    wordBreak: 'break-word',
  },
  ownKey: {
    color: theme.palette.text.secondary,
    marginRight: theme.spacing(0.5),
  },
  ownValue: {
    color: theme.palette.text.primary,
  },
}))

function cellText(value: unknown) {
  return Array.isArray(value)
    ? value.map(valueText).join(', ')
    : valueText(value)
}

const OwnAttributes = observer(function OwnAttributes({
  attributes,
}: {
  attributes: Record<string, unknown>
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.own}>
      {Object.entries(attributes).map(([key, value]) => (
        <span key={key}>
          <span className={classes.ownKey}>{key}</span>
          <span className={classes.ownValue}>
            <ValueText text={cellText(value)} />
          </span>
        </span>
      ))}
    </div>
  )
})

/**
 * One type of a feature's leaf subfeatures — its exons, say — as one card: the
 * attributes they all share once, then a row per part, numbered 5′ to 3′, with
 * what a part carries of its own on a line under its row.
 */
const SubfeatureParts = observer(function SubfeatureParts({
  group,
  locate,
  descriptions,
  formatter,
}: {
  group: PartsGroup
  locate?: (feature: SimpleFeatureSerialized) => (() => void) | undefined
  descriptions?: Descriptors
  formatter?: FeatureFormatter
}) {
  const { classes } = useStyles()
  const { type, parts, shared, phased } = group
  const columns = 3 + Number(phased)
  return (
    <BaseCard title={`${type} (${parts.length})`} defaultExpanded={false}>
      <Attributes
        attributes={shared}
        descriptions={descriptions}
        formatter={formatter}
      />
      <Table size="small" className={classes.table}>
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Position</TableCell>
            <TableCell align="right">Length</TableCell>
            {phased ? <TableCell align="right">Phase</TableCell> : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {parts.map(({ feature: part, own }, idx) => {
            const position = `${toLocale(part.start + 1)}-${toLocale(part.end)}`
            const go = locate?.(part)
            const hasOwn = Object.keys(own).length > 0
            return [
              <TableRow
                key={part.uniqueId}
                className={hasOwn ? classes.followed : undefined}
              >
                <TableCell>{idx + 1}</TableCell>
                <TableCell className={classes.position}>
                  {go ? (
                    <ActionLink
                      title="Show in view"
                      onClick={() => {
                        go()
                      }}
                    >
                      {position}
                    </ActionLink>
                  ) : (
                    position
                  )}
                </TableCell>
                <TableCell align="right">
                  {toLocale(part.end - part.start)}
                </TableCell>
                {phased ? (
                  <TableCell align="right">
                    {part.phase == null ? '' : String(part.phase)}
                  </TableCell>
                ) : null}
              </TableRow>,
              hasOwn ? (
                <TableRow key={`${part.uniqueId}-own`}>
                  <TableCell colSpan={columns} className={classes.ownCell}>
                    <OwnAttributes attributes={own} />
                  </TableCell>
                </TableRow>
              ) : null,
            ]
          })}
        </TableBody>
      </Table>
    </BaseCard>
  )
})

export default SubfeatureParts
