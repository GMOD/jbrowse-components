/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
  Divider,
  Tooltip,
} from '@material-ui/core'
import ExpandMore from '@material-ui/icons/ExpandMore'
import { makeStyles } from '@material-ui/core/styles'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'
import clsx from 'clsx'
import isObject from 'is-object'
import { IAnyStateTreeNode } from 'mobx-state-tree'
import { getConf } from '../configuration'
import { measureText, getSession } from '../util'
import SanitizedHTML from '../ui/SanitizedHTML'
import SequenceFeatureDetails from './SequenceFeatureDetails'
import { BaseCardProps, BaseProps } from './types'
import { SimpleFeatureSerialized } from '../util/simpleFeature'
import { ellipses } from './util'

const MAX_FIELD_NAME_WIDTH = 170

// these are always omitted as too detailed
const globalOmit = [
  'length',
  'position',
  'subfeatures',
  'uniqueId',
  'exonFrames',
  'parentId',
  'thickStart',
  'thickEnd',
]

// coreDetails are omitted in some circumstances
const coreDetails = [
  'name',
  'start',
  'end',
  'strand',
  'refName',
  'description',
  'type',
]

export const useStyles = makeStyles(theme => ({
  expansionPanelDetails: {
    display: 'block',
    padding: theme.spacing(1),
  },
  expandIcon: {
    color: '#FFFFFF',
  },
  field: {
    display: 'flex',
    flexWrap: 'wrap',
  },
  fieldDescription: {
    '&:hover': {
      background: 'yellow',
    },
  },
  fieldName: {
    wordBreak: 'break-all',
    minWidth: '90px',
    borderBottom: '1px solid #0003',
    background: theme.palette.grey[200],
    marginRight: theme.spacing(1),
    padding: theme.spacing(0.5),
  },
  fieldValue: {
    wordBreak: 'break-word',
    maxHeight: 300,
    padding: theme.spacing(0.5),
    overflow: 'auto',
  },
  fieldSubvalue: {
    wordBreak: 'break-word',
    maxHeight: 300,
    padding: theme.spacing(0.5),
    background: theme.palette.grey[100],
    border: `1px solid ${theme.palette.grey[300]}`,
    boxSizing: 'border-box',
    overflow: 'auto',
  },
}))

export function BaseCard({
  children,
  title,
  defaultExpanded = true,
}: BaseCardProps) {
  const classes = useStyles()
  const [expanded, setExpanded] = useState(defaultExpanded)
  return (
    <Accordion
      expanded={expanded}
      onChange={() => setExpanded(s => !s)}
      TransitionProps={{ unmountOnExit: true }}
    >
      <AccordionSummary
        expandIcon={<ExpandMore className={classes.expandIcon} />}
      >
        <Typography variant="button"> {title}</Typography>
      </AccordionSummary>
      <AccordionDetails className={classes.expansionPanelDetails}>
        {children}
      </AccordionDetails>
    </Accordion>
  )
}

export const FieldName = ({
  description,
  name,
  prefix = [],
  width,
}: {
  description?: React.ReactNode
  name: string
  prefix?: string[]
  width?: number
}) => {
  const classes = useStyles()
  const val = [...prefix, name].join('.')
  return description ? (
    <Tooltip title={description} placement="left">
      <div className={clsx(classes.fieldDescription, classes.fieldName)}>
        {val}
      </div>
    </Tooltip>
  ) : (
    <div className={classes.fieldName} style={{ width: width }}>
      {val}
    </div>
  )
}

export const BasicValue = ({ value }: { value: string | React.ReactNode }) => {
  const classes = useStyles()
  return (
    <div className={classes.fieldValue}>
      {React.isValidElement(value) ? (
        value
      ) : (
        <SanitizedHTML
          html={isObject(value) ? JSON.stringify(value) : String(value)}
        />
      )}
    </div>
  )
}

export const SimpleValue = ({
  name,
  value,
  description,
  prefix,
  width,
}: {
  description?: React.ReactNode
  name: string
  value: any
  prefix?: string[]
  width?: number
}) => {
  const classes = useStyles()
  return value !== null && value !== undefined ? (
    <div className={classes.field}>
      <FieldName
        prefix={prefix}
        description={description}
        name={name}
        width={width}
      />
      <BasicValue value={value} />
    </div>
  ) : null
}

const ArrayValue = ({
  name,
  value,
  description,
  prefix = [],
}: {
  description?: React.ReactNode
  name: string
  value: any[]
  prefix?: string[]
}) => {
  const classes = useStyles()
  return (
    <>
      {value.length === 1 ? (
        isObject(value[0]) ? (
          <Attributes attributes={value[0]} prefix={[...prefix, name]} />
        ) : (
          <div className={classes.field}>
            <FieldName prefix={prefix} description={description} name={name} />
            <BasicValue value={value[0]} />
          </div>
        )
      ) : value.every(val => isObject(val)) ? (
        value.map((val, i) => (
          <Attributes
            key={JSON.stringify(val) + '-' + i}
            attributes={val}
            prefix={[...prefix, name + '-' + i]}
          />
        ))
      ) : (
        <div className={classes.field}>
          <FieldName prefix={prefix} description={description} name={name} />
          {value.map((val, i) => (
            <div
              key={JSON.stringify(val) + '-' + i}
              className={classes.fieldSubvalue}
            >
              <BasicValue value={val} />
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function CoreDetails(props: BaseProps) {
  const { feature } = props
  const { refName, start, end, strand } = feature as SimpleFeatureSerialized & {
    start: number
    end: number
    strand: number
    refName: string
  }
  const strandMap: Record<string, string> = {
    '-1': '-',
    '0': '',
    '1': '+',
  }
  const strandStr = strandMap[strand as number] ? `(${strandMap[strand]})` : ''
  const displayStart = (start + 1).toLocaleString('en-US')
  const displayEnd = end.toLocaleString('en-US')
  const displayRef = refName ? `${refName}:` : ''
  const displayedDetails: Record<string, any> = {
    ...feature,
    length: (end - start).toLocaleString('en-US'),
    position: `${displayRef}${displayStart}..${displayEnd} ${strandStr}`,
  }

  const coreRenderedDetails = [
    'Position',
    'Description',
    'Name',
    'Length',
    'Type',
  ]
  return (
    <>
      {coreRenderedDetails
        .map(key => [key, displayedDetails[key.toLowerCase()]])
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([key, value]) => (
          <SimpleValue key={key} name={key} value={value} />
        ))}
    </>
  )
}

export const BaseCoreDetails = (props: BaseProps) => {
  return (
    <BaseCard {...props} title="Primary data">
      <CoreDetails {...props} />
    </BaseCard>
  )
}

interface AttributeProps {
  attributes: Record<string, any>
  omit?: string[]
  formatter?: (val: unknown, key: string) => React.ReactElement
  descriptions?: Record<string, React.ReactNode>
  prefix?: string[]
}

const DataGridDetails = ({
  value,
  prefix,
  name,
}: {
  name: string
  prefix?: string[]
  value: Record<string, any>
}) => {
  const keys = Object.keys(value[0]).sort()
  const unionKeys = new Set(keys)
  value.forEach((val: any) => Object.keys(val).forEach(k => unionKeys.add(k)))
  if (unionKeys.size < keys.length + 5) {
    // avoids key 'id' from being used in row data
    const rows = Object.entries(value).map(([k, val]) => {
      const { id, ...rest } = val
      return {
        id: k, // used by material UI
        identifier: id, // renamed from id to identifier
        ...rest,
      }
    })

    // avoids key 'id' from being used in column names, and tries
    // to make it at the start of the colNames array
    let colNames
    if (unionKeys.has('id')) {
      unionKeys.delete('id')
      colNames = ['identifier', ...unionKeys]
    } else {
      colNames = [...unionKeys]
    }

    const columns = colNames.map(val => ({
      field: val,
      width: Math.max(
        ...rows.map(row => {
          const result = String(row[val])
          return Math.min(Math.max(measureText(result, 14) + 50, 80), 1000)
        }),
      ),
    }))

    // disableSelection on click helps avoid
    // https://github.com/mui-org/material-ui-x/issues/1197
    return (
      <>
        <FieldName prefix={prefix} name={name} />
        <div
          style={{
            height:
              Math.min(rows.length, 100) * 20 +
              50 +
              (rows.length < 100 ? 0 : 50),
            width: '100%',
          }}
        >
          <DataGrid
            disableSelectionOnClick
            rowHeight={20}
            headerHeight={25}
            rows={rows}
            rowsPerPageOptions={[]}
            hideFooterRowCount
            hideFooterSelectedRowCount
            columns={columns}
            hideFooter={rows.length < 100}
          />
        </div>
      </>
    )
  }
  return null
}

// arr = ['a','b'], obj = {a:{b:'hello}}, returns hello (with special addition to grab description also)
function accessNested(arr: string[], obj: Record<string, any> = {}) {
  arr.forEach(elt => {
    if (obj) {
      obj = obj[elt]
    }
  })
  return typeof obj === 'string'
    ? obj
    : typeof obj?.Description === 'string'
    ? obj.Description
    : undefined
}

function generateMaxWidth(array: any, prefix: any) {
  // @ts-ignore
  const arr = []
  array.forEach((key: any, value: any) => {
    const val = [...prefix, key[0]].join('.')
    arr.push(measureText(val, 12))
  })

  // @ts-ignore
  return Math.ceil(Math.max(...arr)) + 10
}

export const Attributes: React.FunctionComponent<AttributeProps> = props => {
  const {
    attributes,
    omit = [],
    descriptions,
    formatter = val => val,
    prefix = [],
  } = props
  const omits = [...omit, ...globalOmit]

  const maxLabelWidth = generateMaxWidth(
    Object.entries(attributes).filter(
      ([k, v]) => v !== undefined && !omits.includes(k),
    ),
    prefix,
  )

  const labelWidth =
    maxLabelWidth <= MAX_FIELD_NAME_WIDTH ? maxLabelWidth : MAX_FIELD_NAME_WIDTH

  return (
    <>
      {Object.entries(attributes)
        .filter(([k, v]) => v !== undefined && !omits.includes(k))
        .map(([key, value]) => {
          if (
            Array.isArray(value) &&
            value.length > 2 &&
            value.every(val => isObject(val))
          ) {
            return (
              <DataGridDetails
                key={key}
                prefix={prefix}
                name={key}
                value={value}
              />
            )
          }

          const description = accessNested([...prefix, key], descriptions)
          if (Array.isArray(value)) {
            return (
              <ArrayValue
                key={key}
                name={key}
                value={value}
                description={description}
                prefix={prefix}
              />
            )
          }

          if (isObject(value)) {
            return (
              <Attributes
                omit={omits}
                key={key}
                attributes={value}
                descriptions={descriptions}
                prefix={[...prefix, key]}
              />
            )
          }

          return (
            <SimpleValue
              key={key}
              name={key}
              value={formatter(value, key)}
              description={description}
              prefix={prefix}
              width={labelWidth}
            />
          )
        })}
    </>
  )
}

export const BaseAttributes = (props: BaseProps) => {
  const { feature } = props
  return (
    <BaseCard {...props} title="Attributes">
      <Attributes {...props} attributes={feature} />
    </BaseCard>
  )
}

export interface BaseInputProps extends BaseCardProps {
  omit?: string[]
  model: any
  descriptions?: Record<string, React.ReactNode>
  formatter?: (val: unknown, key: string) => React.ReactElement
}

function isEmpty(obj: Record<string, unknown>) {
  return Object.keys(obj).length === 0
}

export const FeatureDetails = (props: {
  model: IAnyStateTreeNode
  feature: SimpleFeatureSerialized & { name?: string; id?: string }
  depth?: number
  omit?: string[]
  formatter?: (val: unknown, key: string) => React.ReactElement
}) => {
  const { omit = [], model, feature, depth = 0 } = props
  const { name = '', id = '', type = '', subfeatures } = feature
  const session = getSession(model)
  const defaultSeqTypes = ['mRNA', 'transcript']
  const sequenceTypes =
    getConf(session, ['featureDetails', 'sequenceTypes']) || defaultSeqTypes

  return (
    <BaseCard title={[ellipses(name || id), type].filter(f => !!f).join(' - ')}>
      <Typography>Core details</Typography>
      <CoreDetails {...props} />
      <Divider />
      <Typography>Attributes</Typography>
      <Attributes
        attributes={feature}
        {...props}
        omit={[...omit, ...coreDetails]}
      />

      {sequenceTypes.includes(feature.type) ? (
        <ErrorBoundary
          FallbackComponent={({ error }) => (
            <Typography color="error">
              Failed to fetch sequence for feature: {`${error}`}
            </Typography>
          )}
        >
          <SequenceFeatureDetails {...props} />
        </ErrorBoundary>
      ) : null}

      {subfeatures?.length ? (
        <BaseCard
          title="Subfeatures"
          defaultExpanded={!sequenceTypes.includes(feature.type)}
        >
          {subfeatures.map((sub: any) => (
            <FeatureDetails
              key={JSON.stringify(sub)}
              feature={sub}
              model={model}
              depth={depth + 1}
            />
          ))}
        </BaseCard>
      ) : null}
    </BaseCard>
  )
}

const BaseFeatureDetails = observer((props: BaseInputProps) => {
  const { model } = props
  const { featureData } = model

  if (!featureData) {
    return null
  }
  const feature = JSON.parse(JSON.stringify(featureData))

  if (isEmpty(feature)) {
    return null
  }
  return <FeatureDetails model={model} feature={feature} />
})

export default BaseFeatureDetails
