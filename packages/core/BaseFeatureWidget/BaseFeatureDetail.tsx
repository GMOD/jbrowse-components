/* eslint-disable @typescript-eslint/no-explicit-any,react/prop-types */
import Accordion from '@material-ui/core/Accordion'
import AccordionDetails from '@material-ui/core/AccordionDetails'
import AccordionSummary from '@material-ui/core/AccordionSummary'
import Typography from '@material-ui/core/Typography'
import ExpandMore from '@material-ui/icons/ExpandMore'
import Divider from '@material-ui/core/Divider'
import Paper from '@material-ui/core/Paper'
import Tooltip from '@material-ui/core/Tooltip'
import { makeStyles } from '@material-ui/core/styles'
import { DataGrid } from '@material-ui/data-grid'
import { observer } from 'mobx-react'
import React, { FunctionComponent } from 'react'
import isObject from 'is-object'
import SanitizedHTML from '../ui/SanitizedHTML'

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
  fieldName: {
    wordBreak: 'break-all',
    minWidth: '90px',
    maxWidth: '150px',
    borderBottom: '1px solid #0003',
    backgroundColor: theme.palette.grey[200],
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
    border: `1px solid ${theme.palette.grey[300]}`,
    boxSizing: 'border-box',
    overflow: 'auto',
  },
}))
const coreRenderedDetails = [
  'Position',
  'Description',
  'Name',
  'Length',
  'Type',
]

interface BaseCardProps {
  title?: string
}

export const BaseCard: FunctionComponent<BaseCardProps> = props => {
  const classes = useStyles()
  const { children, title } = props
  return (
    <Accordion style={{ marginTop: '4px' }} defaultExpanded>
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

interface BaseProps extends BaseCardProps {
  feature: Record<string, any>
  descriptions?: Record<string, React.ReactNode>
}

export const BaseCoreDetails = (props: BaseProps) => {
  const classes = useStyles()
  const { feature } = props
  const { refName, start, end, strand } = feature
  const strandMap: Record<number, string> = {
    '-1': '-',
    '0': '',
    '1': '+',
  }
  const strandStr = strandMap[strand] ? `(${strandMap[strand]})` : ''
  const displayedDetails: Record<string, any> = {
    ...feature,
    length: end - start,
    position: `${refName}:${start + 1}..${end} ${strandStr}`,
  }

  return (
    <BaseCard {...props} title="Primary data">
      {coreRenderedDetails.map(key => {
        const value = displayedDetails[key.toLowerCase()]
        const strValue = String(value)
        return value !== null && value !== undefined ? (
          <div className={classes.field} key={key}>
            <div className={classes.fieldName}>{key}</div>
            <div className={classes.fieldValue}>
              <SanitizedHTML html={strValue} />
            </div>
          </div>
        ) : null
      })}
    </BaseCard>
  )
}

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
]

interface AttributeProps {
  attributes: Record<string, any>
  omit?: string[]
  formatter?: (val: unknown) => JSX.Element
  descriptions?: Record<string, React.ReactNode>
  prefix?: string
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
          <div className={classes.fieldName}>{val}</div>
        </Tooltip>
      ) : (
        <div className={classes.fieldName}>{val}</div>
      )}
    </>
  )
}

const BasicValue = ({ value }: { value: string }) => {
  return (
    <SanitizedHTML
      html={isObject(value) ? JSON.stringify(value) : String(value)}
    />
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
function measureText(str: string, fontSize = 10) {
  // prettier-ignore
  const widths = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.2796875,0.2765625,0.3546875,0.5546875,0.5546875,0.8890625,0.665625,0.190625,0.3328125,0.3328125,0.3890625,0.5828125,0.2765625,0.3328125,0.2765625,0.3015625,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.2765625,0.2765625,0.584375,0.5828125,0.584375,0.5546875,1.0140625,0.665625,0.665625,0.721875,0.721875,0.665625,0.609375,0.7765625,0.721875,0.2765625,0.5,0.665625,0.5546875,0.8328125,0.721875,0.7765625,0.665625,0.7765625,0.721875,0.665625,0.609375,0.721875,0.665625,0.94375,0.665625,0.665625,0.609375,0.2765625,0.3546875,0.2765625,0.4765625,0.5546875,0.3328125,0.5546875,0.5546875,0.5,0.5546875,0.5546875,0.2765625,0.5546875,0.5546875,0.221875,0.240625,0.5,0.221875,0.8328125,0.5546875,0.5546875,0.5546875,0.5546875,0.3328125,0.5,0.2765625,0.5546875,0.5,0.721875,0.5,0.5,0.5,0.3546875,0.259375,0.353125,0.5890625]
  const avg = 0.5279276315789471
  return (
    str
      .split('')
      .map(c =>
        c.charCodeAt(0) < widths.length ? widths[c.charCodeAt(0)] : avg,
      )
      .reduce((cur, acc) => acc + cur) * fontSize
  )
}
export const Attributes: FunctionComponent<AttributeProps> = props => {
  const { attributes, omit = [], descriptions = {}, prefix = '' } = props
  const omits = [...omit, ...globalOmit]

  return (
    <>
      {Object.entries(attributes)
        .filter(([k, v]) => v !== undefined && !omits.includes(k))
        .map(([key, value]) => {
          if (Array.isArray(value) && value.length) {
            if (value.length > 2 && value.every(val => isObject(val))) {
              let keys = Object.keys(value[0]).sort()
              const unionKeys = new Set(keys)
              value.forEach(val =>
                Object.keys(val).forEach(k => unionKeys.add(k)),
              )
              if (unionKeys.size < keys.length + 5) {
                keys = [...unionKeys]
                return (
                  <div
                    key={key}
                    style={{ height: value.length * 20 + 80, width: '100%' }}
                  >
                    <FieldName prefix={prefix} name={key} />
                    <DataGrid
                      rowHeight={20}
                      headerHeight={25}
                      hideFooter
                      autoHeight
                      rows={Object.entries(value).map(([k, val]) => ({
                        id: k,
                        ...val,
                      }))}
                      columns={keys.map(val => ({
                        field: val,
                        width: Math.max(
                          ...value.map(row => {
                            const result = String(row[val])
                            return Math.max(measureText(result, 14) + 50, 80)
                          }),
                        ),
                      }))}
                    />
                  </div>
                )
              }
            }
            return (
              <ArrayValue
                key={key}
                name={key}
                value={value}
                description={descriptions[key]}
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
              value={value}
              description={descriptions[key]}
              prefix={prefix}
            />
          )
        })}
    </>
  )
}

export const BaseAttributes = (props: BaseProps) => {
  const { feature, descriptions } = props
  return (
    <BaseCard {...props} title="Attributes">
      <Attributes {...props} attributes={feature} descriptions={descriptions} />
    </BaseCard>
  )
}

export interface BaseInputProps extends BaseCardProps {
  omit?: string[]
  model: any
  formatter?: (val: unknown) => JSX.Element
  descriptions?: Record<string, React.ReactNode>
}

export const BaseFeatureDetails = observer((props: BaseInputProps) => {
  const classes = useStyles()
  const { model, descriptions } = props
  const feat = JSON.parse(JSON.stringify(model.featureData))
  return (
    <Paper className={classes.paperRoot}>
      <BaseCoreDetails feature={feat} {...props} />
      <Divider />
      <BaseAttributes feature={feat} {...props} descriptions={descriptions} />
    </Paper>
  )
})
