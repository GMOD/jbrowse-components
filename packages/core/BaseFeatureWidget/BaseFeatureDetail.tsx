/* eslint-disable @typescript-eslint/no-explicit-any,react/prop-types */
import React, { useEffect, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
  Divider,
  Paper,
  Tooltip,
} from '@material-ui/core'
import ExpandMore from '@material-ui/icons/ExpandMore'
import { makeStyles } from '@material-ui/core/styles'
import { DataGrid } from '@material-ui/data-grid'
import { observer } from 'mobx-react'
import clsx from 'clsx'
import isObject from 'is-object'
import { readConfObject } from '../configuration'
import { measureText, getSession } from '../util'
import { Feature } from '../util/simpleFeature'
import SanitizedHTML from '../ui/SanitizedHTML'

const globalOmit = [
  'name',
  'start',
  'end',
  'strand',
  'refName',
  'type',
  'length',
  'position',
  'subfeatures',
  'uniqueId',
  'exonFrames',
  'parentId',
  'thickStart',
  'thickEnd',
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
}))

interface BaseCardProps {
  title?: string
  defaultExpanded?: boolean
  children?: React.ReactNode
}

export function BaseCard({
  children,
  title,
  defaultExpanded = true,
}: BaseCardProps) {
  const classes = useStyles()
  return (
    <Accordion
      style={{ marginTop: '4px' }}
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
  prefix,
}: {
  description?: React.ReactNode
  name: string
  prefix?: string
}) => {
  const classes = useStyles()
  const val = (prefix ? `${prefix}.` : '') + name
  return (
    <>
      {description ? (
        <Tooltip title={description} placement="left">
          <div className={clsx(classes.fieldDescription, classes.fieldName)}>
            {val}
          </div>
        </Tooltip>
      ) : (
        <div className={classes.fieldName}>{val}</div>
      )}
    </>
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
  prefix?: string
}) => {
  const classes = useStyles()
  return value ? (
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
  prefix?: string
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

interface BaseProps extends BaseCardProps {
  feature: any
  descriptions?: Record<string, React.ReactNode>
  model?: any
}

function SequenceFeatureDetails(props: BaseProps) {
  const { model, feature } = props
  const { assemblyManager, rpcManager } = getSession(model)
  const { assemblyNames } = model.view
  const [sequence, setSequence] = useState<string>()
  const [assemblyName] = assemblyNames
  useEffect(() => {
    ;(async () => {
      const assemblyConfig = assemblyManager.get(assemblyName)?.configuration
      const adapterConfig = readConfObject(assemblyConfig, [
        'sequence',
        'adapter',
      ])
      const sessionId = 'getSequence'
      const region = {
        start: feature.start,
        end: feature.end,
        refName: feature.refName,
      }
      const feats = await rpcManager.call(sessionId, 'CoreGetFeatures', {
        adapterConfig,
        region,
        sessionId,
      })
      const [feat] = feats as Feature[]
      setSequence(feat.get('seq'))
    })()
  }, [feature, assemblyManager, rpcManager, assemblyName])

  return <div>Hello world {sequence}</div>
}

function CoreDetails(props: BaseProps) {
  const { feature } = props
  const { refName, start, end, strand } = feature
  const strandMap: Record<string, string> = {
    '-1': '-',
    '0': '',
    '1': '+',
  }
  const strandStr = strandMap[strand] ? `(${strandMap[strand]})` : ''
  const displayStart = (start + 1).toLocaleString('en-US')
  const displayEnd = end.toLocaleString('en-US')
  const displayRef = refName ? `${refName}:` : ''
  const displayedDetails: Record<string, any> = {
    ...feature,
    length: end - start,
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
  prefix?: string
}

export const Attributes: React.FunctionComponent<AttributeProps> = props => {
  const {
    attributes,
    omit = [],
    descriptions,
    formatter = val => val,
    prefix = '',
  } = props
  const omits = [...omit, ...globalOmit]

  return (
    <>
      {Object.entries(attributes)
        .filter(([k, v]) => v !== undefined && !omits.includes(k))
        .map(([key, value]) => {
          if (Array.isArray(value) && value.length) {
            if (value.length > 2 && value.every(val => isObject(val))) {
              const keys = Object.keys(value[0]).sort()
              const unionKeys = new Set(keys)
              value.forEach(val =>
                Object.keys(val).forEach(k => unionKeys.add(k)),
              )
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
                      return Math.min(
                        Math.max(measureText(result, 14) + 50, 80),
                        1000,
                      )
                    }),
                  ),
                }))

                return (
                  <React.Fragment key={key}>
                    <FieldName prefix={prefix} name={key} />
                    <div
                      key={key}
                      style={{
                        height:
                          Math.min(rows.length, 100) * 20 +
                          50 +
                          (rows.length < 100 ? 0 : 50),
                        width: '100%',
                      }}
                    >
                      <DataGrid
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
                  </React.Fragment>
                )
              }
            }
          }
          const description = descriptions && descriptions[key]
          if (Array.isArray(value)) {
            return value.length === 1 ? (
              <SimpleValue
                key={key}
                name={key}
                value={value[0]}
                description={description}
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
          }
          if (isObject(value)) {
            return (
              <Attributes
                key={key}
                attributes={value}
                descriptions={descriptions}
                prefix={key}
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

function Subfeature(props: BaseProps) {
  const { feature } = props
  const { type, name, id } = feature
  const displayName = name || id
  return (
    <BaseCard title={`${displayName ? `${displayName} - ` : ''}${type}`}>
      <CoreDetails {...props} />
      <Divider />
      <Attributes attributes={feature} {...props} />
      <div>
        <SequenceFeatureDetails {...props} />
      </div>
      {feature.subfeatures && feature.subfeatures.length ? (
        <BaseCard title="Subfeatures" defaultExpanded={false}>
          {feature.subfeatures.map((subfeature: any) => (
            <Subfeature key={JSON.stringify(subfeature)} feature={subfeature} />
          ))}
        </BaseCard>
      ) : null}
    </BaseCard>
  )
}

function isEmpty(obj: Record<string, unknown>) {
  return Object.keys(obj).length === 0
}

export const BaseFeatureDetails = observer((props: BaseInputProps) => {
  const classes = useStyles()
  const { model } = props

  if (!model.featureData) {
    return null
  }
  const feature = JSON.parse(JSON.stringify(model.featureData))

  if (isEmpty(feature)) {
    return null
  }
  return (
    <Paper className={classes.paperRoot}>
      <BaseCoreDetails feature={feature} {...props} />
      <Divider />
      <BaseAttributes feature={feature} {...props} />
      {feature.subfeatures && feature.subfeatures.length ? (
        <BaseCard title="Subfeatures">
          {feature.subfeatures.map((subfeature: any) => (
            <Subfeature
              key={JSON.stringify(subfeature)}
              feature={subfeature}
              model={model}
            />
          ))}
        </BaseCard>
      ) : null}
    </Paper>
  )
})
