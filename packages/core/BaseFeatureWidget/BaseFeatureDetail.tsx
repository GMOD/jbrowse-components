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
    backgroundColor: theme.palette.grey[100],
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
  defaultExpanded?: boolean
}

export const BaseCard: FunctionComponent<BaseCardProps> = props => {
  const classes = useStyles()
  const { children, title, defaultExpanded = true } = props
  return (
    <Accordion style={{ marginTop: '4px' }} defaultExpanded={defaultExpanded}>
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
          <div className={classes.fieldName}>{val}</div>
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
}

const CoreDetails = (props: BaseProps) => {
  const { feature } = props
  const { refName, start, end, strand } = feature
  const strandMap: Record<string, string> = {
    '-1': '-',
    '0': '',
    '1': '+',
  }
  const strandStr = strandMap[strand] ? `(${strandMap[strand]})` : ''
  const displayedDetails: Record<string, any> = {
    ...feature,
    length: end - start,
    position: `${refName ? `${refName}:` : ''}${
      start + 1
    }..${end} ${strandStr}`,
  }
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

const omit = [
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

interface AttributeProps {
  attributes: Record<string, any>
  omit?: string[]
  formatter?: (val: unknown) => JSX.Element
  descriptions?: Record<string, React.ReactNode>
}

export const Attributes: FunctionComponent<AttributeProps> = props => {
  const {
    attributes,
    omit: propOmit = [],
    descriptions,
    formatter = val => val,
  } = props

  return (
    <>
      {Object.entries(attributes)
        .filter(
          ([k, v]) =>
            v !== undefined && !omit.includes(k) && !propOmit.includes(k),
        )
        .map(([key, value]) => {
          if (Array.isArray(value)) {
            return value.length === 1 ? (
              <SimpleValue key={key} name={key} value={value[0]} />
            ) : (
              <ArrayValue key={key} name={key} value={value} />
            )
          }
          if (isObject(value)) {
            return (
              <Attributes
                key={key}
                attributes={value}
                descriptions={descriptions}
              />
            )
          }

          return <SimpleValue key={key} name={key} value={formatter(value)} />
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
  descriptions?: Record<string, React.ReactNode>
  formatter?: (val: unknown) => JSX.Element
}
const Subfeature = (props: BaseProps) => {
  const { feature } = props
  const { type, name, id } = feature
  const displayName = name || id
  return (
    <BaseCard title={`${displayName ? `${displayName} - ` : ''}${type}`}>
      <CoreDetails {...props} />
      <Divider />
      <Attributes attributes={feature} {...props} />
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
export const BaseFeatureDetails = observer((props: BaseInputProps) => {
  const classes = useStyles()
  const { model, descriptions } = props
  const feature = JSON.parse(JSON.stringify(model.featureData))
  return (
    <Paper className={classes.paperRoot}>
      <BaseCoreDetails feature={feature} {...props} />
      <Divider />
      <BaseAttributes
        feature={feature}
        {...props}
        descriptions={descriptions}
      />
      {feature.subfeatures && feature.subfeatures.length ? (
        <BaseCard title="Subfeatures">
          {feature.subfeatures.map((subfeature: any) => (
            <Subfeature key={JSON.stringify(subfeature)} feature={subfeature} />
          ))}
        </BaseCard>
      ) : null}
    </Paper>
  )
})
