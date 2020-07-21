/* eslint-disable @typescript-eslint/no-explicit-any,react/prop-types */
import ExpansionPanel from '@material-ui/core/ExpansionPanel'
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails'
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary'
import Typography from '@material-ui/core/Typography'
import ExpandMore from '@material-ui/icons/ExpandMore'
import Divider from '@material-ui/core/Divider'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
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
  title: string
}

export const BaseCard: FunctionComponent<BaseCardProps> = props => {
  const classes = useStyles()
  const { children, title } = props
  return (
    <ExpansionPanel style={{ marginTop: '4px' }} defaultExpanded>
      <ExpansionPanelSummary
        expandIcon={<ExpandMore className={classes.expandIcon} />}
      >
        <Typography variant="button"> {title}</Typography>
      </ExpansionPanelSummary>
      <ExpansionPanelDetails className={classes.expansionPanelDetails}>
        {children}
      </ExpansionPanelDetails>
    </ExpansionPanel>
  )
}
BaseCard.propTypes = {
  // @ts-ignore
  children: PropTypes.node.isRequired,
  title: PropTypes.string.isRequired,
}

interface BaseProps extends BaseCardProps {
  feature: Record<string, any>
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
        return value ? (
          <div key={key} style={{ display: 'flex' }}>
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
]

interface AttributeProps {
  attributes: Record<string, any>
  omit: string[]
  formatter: (val: unknown) => JSX.Element
}

const Attributes: FunctionComponent<AttributeProps> = props => {
  const classes = useStyles()
  const {
    attributes,
    omit: propOmit = [],
    formatter = (value: unknown) => (
      <SanitizedHTML
        html={isObject(value) ? JSON.stringify(value) : String(value)}
      />
    ),
  } = props

  const SimpleValue = ({ name, value }: { name: string; value: any }) => {
    return (
      <div style={{ display: 'flex' }}>
        <div className={classes.fieldName}>{name}</div>
        <div className={classes.fieldValue}>{formatter(value)}</div>
      </div>
    )
  }
  const ArrayValue = ({ name, value }: { name: string; value: any[] }) => (
    <div style={{ display: 'flex' }}>
      <div className={classes.fieldName}>{name}</div>
      {value.map((val, i) => (
        <div key={`${name}-${i}`} className={classes.fieldSubvalue}>
          <SanitizedHTML
            html={isObject(val) ? JSON.stringify(val) : String(val)}
          />
        </div>
      ))}
    </div>
  )

  return (
    <>
      {Object.entries(attributes)
        .filter(
          ([k, v]) =>
            v !== undefined && !omit.includes(k) && !propOmit.includes(k),
        )
        .map(([key, value]) => {
          if (Array.isArray(value)) {
            // eslint-disable-next-line react/prop-types
            return value.length === 1 ? (
              <SimpleValue key={key} name={key} value={value[0]} />
            ) : (
              <ArrayValue key={key} name={key} value={value} />
            )
          }
          if (isObject(value)) {
            return <Attributes key={key} attributes={value} />
          }

          return <SimpleValue key={key} name={key} value={value} />
        })}
    </>
  )
}
Attributes.propTypes = {
  attributes: PropTypes.objectOf(PropTypes.any).isRequired,
}
export const BaseAttributes = (props: BaseProps) => {
  const { feature } = props
  return (
    <BaseCard {...props} title="Attributes">
      <Attributes {...props} attributes={feature} />
    </BaseCard>
  )
}

interface BaseInputProps extends BaseCardProps {
  model: any
}

export const BaseFeatureDetails = observer((props: BaseInputProps) => {
  const classes = useStyles()
  const { model } = props
  const feat = JSON.parse(JSON.stringify(model.featureData))
  return (
    <Paper className={classes.paperRoot}>
      <BaseCoreDetails feature={feat} {...props} />
      <Divider />
      <BaseAttributes feature={feat} {...props} />
    </Paper>
  )
})
