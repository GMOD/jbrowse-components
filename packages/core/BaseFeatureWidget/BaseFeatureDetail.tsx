/* eslint-disable @typescript-eslint/no-explicit-any,react/prop-types */
import React from 'react'
import ErrorBoundary from 'react-error-boundary'
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
import { DataGrid } from '@material-ui/data-grid'
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
  paperRoot: {
    background: theme.palette.grey[100],
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
    maxWidth: '150px',
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

  accordionBorder: {
    marginTop: '4px',
    border: '1px solid #444',
  },
}))

export function BaseCard({
  children,
  title,
  defaultExpanded = true,
}: BaseCardProps) {
  const classes = useStyles()
  return (
    <Accordion
      className={classes.accordionBorder}
      defaultExpanded={defaultExpanded}
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

const FieldName = ({
  description,
  name,
  prefix = [],
}: {
  description?: React.ReactNode
  name: string
  prefix?: string[]
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
    <div className={classes.fieldName}>{val}</div>
  )
}

const BasicValue = ({ value }: { value: string | React.ReactNode }) => {
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
const SimpleValue = ({
  name,
  value,
  description,
  prefix,
}: {
  description?: React.ReactNode
  name: string
  value: any
  prefix?: string[]
}) => {
  const classes = useStyles()
  return value !== null && value !== undefined ? (
    <div className={classes.field}>
      <FieldName prefix={prefix} description={description} name={name} />
      <BasicValue value={value} />
    </div>
  ) : null
}

const ArrayValue = ({
  name,
  value,
  description,
  prefix,
}: {
  description?: React.ReactNode
  name: string
  value: any[]
  prefix?: string[]
}) => {
  const classes = useStyles()
  return (
    <div className={classes.field}>
      <FieldName prefix={prefix} description={description} name={name} />
      {value.length === 1 ? (
        <BasicValue value={value[0]} />
      ) : (
        value.map((val, i) => (
          <div key={`${name}-${i}`} className={classes.fieldSubvalue}>
            <BasicValue value={val} />
          </div>
        ))
      )}
    </div>
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
      {coreRenderedDetails.map(key => {
        const value = displayedDetails[key.toLowerCase()]
        return value !== null && value !== undefined ? (
          <SimpleValue key={key} name={key} value={value} />
        ) : null
      })}
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
  formatter?: (val: unknown, key: string) => JSX.Element
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

export const Attributes: React.FunctionComponent<AttributeProps> = props => {
  const {
    attributes,
    omit = [],
    descriptions,
    formatter = val => val,
    prefix = [],
  } = props
  const omits = [...omit, ...globalOmit]

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
  formatter?: (val: unknown, key: string) => JSX.Element
}

function isEmpty(obj: Record<string, unknown>) {
  return Object.keys(obj).length === 0
}

export const FeatureDetails = (props: {
  model: IAnyStateTreeNode
  feature: SimpleFeatureSerialized & { name?: string; id?: string }
  depth?: number
  omit?: string[]
  formatter?: (val: unknown, key: string) => JSX.Element
}) => {
  const { omit = [], model, feature, depth = 0 } = props
  const { name, id, type = '', subfeatures } = feature
  const slug = name || id || ''
  const shortName = slug.length > 20 ? `${slug}...` : slug
  const title = `${shortName}${type ? ` - ${type}` : ''}`
  const session = getSession(model)
  const defSeqTypes = ['mRNA', 'transcript']
  const sequenceTypes =
    getConf(session, ['featureDetails', 'sequenceTypes']) || defSeqTypes

  return (
    <BaseCard title={title}>
      <div>Core details</div>
      <CoreDetails {...props} />
      <Divider />
      <div>Attributes</div>
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
      {subfeatures && subfeatures.length ? (
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
