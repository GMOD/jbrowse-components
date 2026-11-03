import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'
import { observer } from 'mobx-react'

import ActionLink from '../../ui/ActionLink.tsx'
import { toLocale } from '../../util/index.ts'
import { makeStyles } from '../../util/tss-react/index.ts'
import { ArrayItems } from './ArrayValue.tsx'
import Attributes from './Attributes.tsx'
import BaseCard from './BaseCard.tsx'
import { ValueText, valueText } from './BasicValue.tsx'
import TranslExceptList from './TranslExceptList.tsx'
import { spanLocator } from './featureNavigator.ts'
import { parseTranslExcept } from './translExcept.ts'

import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { Descriptors, FeatureFormatter } from '../types.tsx'
import type { LocateSpan } from './TranslExceptList.tsx'
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
  number: {
    width: '2.5em',
  },
  followed: {
    '& td': {
      borderBottom: 'none',
    },
  },
  ownCell: {
    paddingTop: 0,
    paddingBottom: theme.spacing(0.75),
  },
  own: {
    display: 'grid',
    columnGap: theme.spacing(1.5),
    rowGap: 1,
    fontSize: 12,
    lineHeight: 1.4,
  },
  ownKey: {
    color: theme.palette.text.secondary,
  },
  ownValue: {
    wordBreak: 'break-word',
  },
}))

const OwnValue = observer(function OwnValue({
  name,
  value,
  locateSpan,
}: {
  name: string
  value: unknown
  locateSpan?: LocateSpan
}) {
  const exceptions =
    name === 'transl_except' ? parseTranslExcept(value) : undefined
  return exceptions ? (
    <TranslExceptList exceptions={exceptions} locate={locateSpan} />
  ) : Array.isArray(value) ? (
    <ArrayItems name={name} value={value} />
  ) : (
    <ValueText text={valueText(value)} />
  )
})

// every part's keys share one column width, so values align down the card
const OwnAttributes = observer(function OwnAttributes({
  attributes,
  keyWidth,
  locateSpan,
}: {
  attributes: Record<string, unknown>
  keyWidth: number
  locateSpan?: LocateSpan
}) {
  const { classes } = useStyles()
  return (
    <div
      className={classes.own}
      style={{ gridTemplateColumns: `${keyWidth}ch minmax(0, 1fr)` }}
    >
      {Object.entries(attributes).map(([key, value]) => [
        <span key={`${key}-key`} className={classes.ownKey}>
          {key}
        </span>,
        <span key={`${key}-value`} className={classes.ownValue}>
          <OwnValue name={key} value={value} locateSpan={locateSpan} />
        </span>,
      ])}
    </div>
  )
})

/**
 * One type of a feature's leaf subfeatures — its exons, say — as one card: the
 * attributes they all share once, then a row per part, numbered 5′ to 3′. What
 * a part carries of its own is listed key by key under its row.
 */
const SubfeatureParts = observer(function SubfeatureParts({
  group,
  owner,
  parent,
  locate,
  descriptions,
  formatter,
}: {
  group: PartsGroup
  /** the readable name of the feature these are parts of */
  owner?: string
  parent: SimpleFeatureSerialized
  locate?: (feature: SimpleFeatureSerialized) => (() => void) | undefined
  descriptions?: Descriptors
  formatter?: FeatureFormatter
}) {
  const { classes } = useStyles()
  const { type, parts, shared, phased } = group
  const keyWidth = Math.max(
    0,
    ...parts.flatMap(part => Object.keys(part.own).map(key => key.length)),
  )
  const title = [owner, `${type} (${parts.length})`]
    .filter(part => part !== undefined)
    .join(' · ')
  return (
    <BaseCard title={title} defaultExpanded={false}>
      <Attributes
        attributes={shared}
        descriptions={descriptions}
        formatter={formatter}
        locateSpan={spanLocator(locate, parent)}
      />
      <Table size="small" className={classes.table}>
        <TableHead>
          <TableRow>
            <TableCell className={classes.number}>#</TableCell>
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
                  <TableCell />
                  <TableCell
                    colSpan={2 + Number(phased)}
                    className={classes.ownCell}
                  >
                    <OwnAttributes
                      attributes={own}
                      keyWidth={keyWidth}
                      locateSpan={spanLocator(locate, part)}
                    />
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
