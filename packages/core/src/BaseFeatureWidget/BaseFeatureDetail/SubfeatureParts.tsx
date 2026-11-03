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
import type { SubfeatureGroup } from './subfeatureGroups.ts'

const useStyles = makeStyles()(theme => ({
  table: {
    marginTop: theme.spacing(0.5),
    '& th, & td': {
      fontSize: 12,
      padding: theme.spacing(0.25, 1),
      whiteSpace: 'nowrap',
    },
  },
  scroll: {
    overflowX: 'auto',
  },
}))

function cellText(value: unknown) {
  return value == null
    ? ''
    : Array.isArray(value)
      ? value.map(valueText).join(', ')
      : valueText(value)
}

/**
 * One type of a feature's leaf subfeatures — its exons, say — as one card: the
 * attributes they all share once, then a row per part, numbered 5′ to 3′.
 */
const SubfeatureParts = observer(function SubfeatureParts({
  group,
  locate,
  descriptions,
  formatter,
}: {
  group: Extract<SubfeatureGroup, { kind: 'parts' }>
  locate?: (feature: SimpleFeatureSerialized) => (() => void) | undefined
  descriptions?: Descriptors
  formatter?: FeatureFormatter
}) {
  const { classes } = useStyles()
  const { type, parts, shared, varying } = group
  return (
    <BaseCard title={`${type} (${parts.length})`} defaultExpanded={false}>
      <Attributes
        attributes={shared}
        descriptions={descriptions}
        formatter={formatter}
      />
      <div className={classes.scroll}>
        <Table size="small" className={classes.table}>
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Position</TableCell>
              <TableCell align="right">Length</TableCell>
              {varying.map(key => (
                <TableCell key={key}>{key}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {parts.map((part, idx) => {
              const position = `${toLocale(part.start + 1)}-${toLocale(part.end)}`
              const go = locate?.(part)
              return (
                <TableRow key={part.uniqueId}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>
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
                  {varying.map(key => (
                    <TableCell key={key}>
                      <ValueText text={cellText(part[key])} />
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </BaseCard>
  )
})

export default SubfeatureParts
