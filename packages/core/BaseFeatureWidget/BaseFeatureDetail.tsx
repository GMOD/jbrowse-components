/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Divider,
  Tooltip,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import ExpandMore from '@mui/icons-material/ExpandMore'
import { DataGrid, GridCellParams } from '@mui/x-data-grid'
import { observer } from 'mobx-react'
import isObject from 'is-object'
import { IAnyStateTreeNode } from 'mobx-state-tree'

// locals
import {
  measureText,
  measureGridWidth,
  getStr,
  getUriLink,
  isUriLocation,
} from '../util'
import { ErrorMessage, SanitizedHTML } from '../ui'
import SequenceFeatureDetails from './SequenceFeatureDetails'
import { BaseCardProps, BaseProps } from './types'
import { SimpleFeatureSerializedNoId } from '../util/simpleFeature'
import { ellipses } from './util'

const MAX_FIELD_NAME_WIDTH = 170

// these are always omitted as too detailed
const globalOmit = [
  '__jbrowsefmt',
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

export const useStyles = makeStyles()(theme => ({
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
    minWidth: 90,
    borderBottom: '1px solid #0003',
    fontSize: 12,
    background: theme.palette.grey[200],
    marginRight: theme.spacing(1),
    padding: theme.spacing(0.5),
  },
  fieldValue: {
    wordBreak: 'break-word',
    maxHeight: 300,
    fontSize: 12,
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
  const { classes } = useStyles()
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
  width,
  prefix = [],
}: {
  description?: React.ReactNode
  name: string
  prefix?: string[]
  width?: number
}) => {
  const { classes, cx } = useStyles()
  const val = [...prefix, name].join('.')
  return description ? (
    <Tooltip title={description} placement="left">
      <div className={cx(classes.fieldDescription, classes.fieldName)}>
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
  const { classes } = useStyles()
  const isLink = `${value}`.match(/^https?:\/\//)
  return (
    <div className={classes.fieldValue}>
      {React.isValidElement(value) ? (
        value
      ) : isLink ? (
        <SanitizedHTML html={`<a href="${value}">${value}</a>`} />
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
  const { classes } = useStyles()
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
  const { classes } = useStyles()
  if (value.length === 1) {
    return isObject(value[0]) ? (
      <Attributes attributes={value[0]} prefix={[...prefix, name]} />
    ) : (
      <div className={classes.field}>
        <FieldName prefix={prefix} description={description} name={name} />
        <BasicValue value={value[0]} />
      </div>
    )
  } else if (value.every(val => isObject(val))) {
    return (
      <>
        {value.map((val, i) => (
          <Attributes
            key={JSON.stringify(val) + '-' + i}
            attributes={val}
            prefix={[...prefix, name + '-' + i]}
          />
        ))}
      </>
    )
  } else {
    return (
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
    )
  }
}
const toLocale = (n: number) => n.toLocaleString('en-US')

function CoreDetails(props: BaseProps) {
  const { feature } = props
  const obj = feature as SimpleFeatureSerializedNoId & {
    start: number
    end: number
    strand: number
    refName: string
    __jbrowsefmt: {
      start?: number
      end?: number
      refName?: string
      name?: string
    }
  }

  // eslint-disable-next-line no-underscore-dangle
  const formattedFeat = { ...obj, ...obj.__jbrowsefmt }
  const { start, strand, end, refName } = formattedFeat

  const strandMap: Record<string, string> = {
    '-1': '-',
    '0': '',
    '1': '+',
  }
  const str = strandMap[strand as number] ? `(${strandMap[strand]})` : ''
  const displayedDetails: Record<string, any> = {
    ...formattedFeat,
    length: toLocale(end - start),
    position: `${refName}:${toLocale(start + 1)}..${toLocale(end)} ${str}`,
  }

  const coreRenderedDetails = {
    position: 'Position',
    description: 'Description',
    name: 'Name',
    length: 'Length',
    type: 'Type',
    assemblyName: 'Assembly name',
  }
  return (
    <>
      {Object.entries(coreRenderedDetails)
        .map(([key, name]) => [name, displayedDetails[key]])
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([name, value]) => (
          <SimpleValue key={name} name={name} value={value} />
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
  formatter?: (val: unknown, key: string) => React.ReactNode
  descriptions?: Record<string, React.ReactNode>
  prefix?: string[]
}

export function UriLink({
  value,
}: {
  value: { uri: string; baseUri?: string }
}) {
  const href = getUriLink(value)
  return <SanitizedHTML html={`<a href="${href}">${href}</a>`} />
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
      renderCell: (params: GridCellParams) => {
        const { value } = params
        return isUriLocation(value) ? <UriLink value={value} /> : getStr(value)
      },
      width: measureGridWidth(rows.map(r => r[val])),
    }))

    const rowHeight = 25
    const hideFooter = rows.length < 100
    const headerHeight = 80
    // disableSelection on click helps avoid
    // https://github.com/mui-org/material-ui-x/issues/1197
    return (
      <>
        <FieldName prefix={prefix} name={name} />
        <div
          style={{
            height:
              Math.min(rows.length, 100) * rowHeight +
              headerHeight +
              (hideFooter ? 0 : 50),
            width: '100%',
          }}
        >
          <DataGrid
            disableSelectionOnClick
            rowHeight={rowHeight}
            rows={rows}
            rowsPerPageOptions={[]}
            hideFooterSelectedRowCount
            columns={columns}
            hideFooter={hideFooter}
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

function UriAttribute({
  value,
  prefix,
  name,
}: {
  value: { uri: string; baseUri?: string }
  name: string
  prefix: string[]
}) {
  const { classes } = useStyles()
  const { uri, baseUri = '' } = value
  let href
  try {
    href = new URL(uri, baseUri).href
  } catch (e) {
    href = uri
  }
  return (
    <div className={classes.field}>
      <FieldName prefix={prefix} name={name} />
      <BasicValue value={href} />
    </div>
  )
}

export function Attributes(props: AttributeProps) {
  const {
    attributes,
    omit = [],
    descriptions,
    formatter = val => val,
    prefix = [],
  } = props
  const omits = [...omit, ...globalOmit]
  const { __jbrowsefmt, ...rest } = attributes
  const formattedAttributes = { ...rest, ...__jbrowsefmt }

  const maxLabelWidth = generateMaxWidth(
    Object.entries(formattedAttributes).filter(
      ([k, v]) => v !== undefined && !omits.includes(k),
    ),
    prefix,
  )

  return (
    <>
      {Object.entries(formattedAttributes)
        .filter(([k, v]) => v !== undefined && !omits.includes(k))
        .map(([key, value]) => {
          const description = accessNested([...prefix, key], descriptions)
          if (Array.isArray(value)) {
            // check if it looks like an array of objects, which could be used
            // in data grid
            return value.length > 1 && value.every(val => isObject(val)) ? (
              <DataGridDetails
                key={key}
                name={key}
                prefix={prefix}
                value={value}
              />
            ) : (
              <ArrayValue
                key={key}
                name={key}
                value={value}
                description={description}
                prefix={prefix}
              />
            )
          } else if (isObject(value)) {
            return isUriLocation(value) ? (
              <UriAttribute
                key={key}
                name={key}
                prefix={prefix}
                value={value}
              />
            ) : (
              <Attributes
                {...props}
                omit={omits}
                key={key}
                attributes={value}
                descriptions={descriptions}
                prefix={[...prefix, key]}
              />
            )
          } else {
            return (
              <SimpleValue
                key={key}
                name={key}
                value={formatter(value, key)}
                description={description}
                prefix={prefix}
                width={Math.min(maxLabelWidth, MAX_FIELD_NAME_WIDTH)}
              />
            )
          }
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
  formatter?: (val: unknown, key: string) => React.ReactNode
}

function isEmpty(obj: Record<string, unknown>) {
  return Object.keys(obj).length === 0
}

function generateTitle(name: unknown, id: unknown, type: unknown) {
  return [ellipses(`${name}` || `${id}`), `${type}`]
    .filter(f => !!f)
    .join(' - ')
}

export const FeatureDetails = (props: {
  model: IAnyStateTreeNode
  feature: SimpleFeatureSerializedNoId
  depth?: number
  omit?: string[]
  formatter?: (val: unknown, key: string) => React.ReactNode
}) => {
  const { omit = [], model, feature, depth = 0 } = props
  const { name = '', id = '', type = '', subfeatures } = feature

  return (
    <BaseCard title={generateTitle(name, id, type)}>
      <Typography>Core details</Typography>
      <CoreDetails {...props} />
      <Divider />
      <Typography>Attributes</Typography>
      <Attributes
        attributes={feature}
        {...props}
        omit={[...omit, ...coreDetails]}
      />

      <ErrorBoundary
        FallbackComponent={({ error }) => <ErrorMessage error={error} />}
      >
        <SequenceFeatureDetails {...props} />
      </ErrorBoundary>

      {subfeatures?.length ? (
        <BaseCard title="Subfeatures" defaultExpanded={depth < 1}>
          {subfeatures.map(sub => (
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

const BaseFeatureDetails = observer(({ model }: BaseInputProps) => {
  const { featureData } = model

  if (!featureData) {
    return null
  }

  // replacing undefined with null helps with allowing fields to be hidden,
  // setting null is not allowed by jexl so we set it to undefined to hide. see
  // config guide. this replacement happens both here and when snapshotting the
  // featureData
  const feature = JSON.parse(
    JSON.stringify(featureData, (_, v) =>
      typeof v === 'undefined' ? null : v,
    ),
  )

  return isEmpty(feature) ? null : (
    <FeatureDetails model={model} feature={feature} />
  )
})

export default BaseFeatureDetails
