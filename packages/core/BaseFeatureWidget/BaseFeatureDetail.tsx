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
}

const FieldName = ({
  description,
  name,
}: {
  description?: React.ReactNode
  name: string
}) => {
  const classes = useStyles()
  return (
    <>
      {description ? (
        <Tooltip title={description} placement="left">
          <div className={classes.fieldName}>{name}</div>
        </Tooltip>
      ) : (
        <div className={classes.fieldName}>{name}</div>
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
}: {
  description?: React.ReactNode
  name: string
  value: any
}) => {
  const classes = useStyles()
  return value ? (
    <div className={classes.field}>
      <FieldName description={description} name={name} />
      <BasicValue value={value} />
    </div>
  ) : null
}

const ArrayValue = ({
  name,
  value,
  description,
}: {
  description?: React.ReactNode
  name: string
  value: any[]
}) => {
  const classes = useStyles()
  return (
    <div className={classes.field}>
      <FieldName description={description} name={name} />
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

export const Attributes: FunctionComponent<AttributeProps> = props => {
  const { attributes, omit = [], descriptions = {} } = props
  const omits = [...omit, ...globalOmit]

  return (
    <>
      {Object.entries(attributes)
        .filter(([k, v]) => v !== undefined && !omits.includes(k))
        .map(([key, value]) => {
          if (Array.isArray(value)) {
            return (
              <ArrayValue
                key={key}
                name={key}
                value={value}
                description={descriptions[name]}
              />
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

          return (
            <SimpleValue
              key={key}
              name={key}
              value={value}
              description={descriptions[name]}
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
