/* eslint-disable react/prop-types */
import ExpansionPanel from '@material-ui/core/ExpansionPanel'
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails'
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary'
import Icon from '@material-ui/core/Icon'
import Typography from '@material-ui/core/Typography'
import Divider from '@material-ui/core/Divider'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import React, { FunctionComponent } from 'react'
import isObject from 'is-object'

const useStyles = makeStyles(theme => ({
  expansionPanelDetails: {
    display: 'block',
    padding: theme.spacing(1),
  },
  content: {
    '&$expanded': {
      margin: theme.spacing(1, 0),
    },
    margin: theme.spacing(1, 0),
  },
  paperRoot: {
    background: theme.palette.grey[100],
  },
  root: {
    background: theme.palette.grey[300],
    '&$expanded': {
      // overrides the subclass e.g. .MuiExpansionPanelSummary-root-311.MuiExpansionPanelSummary-expanded-312
      minHeight: 0,
      margin: 0,
    },
    margin: 0,
    minHeight: 0,
    padding: theme.spacing(0, 1),
  },
  expanded: {
    // empty block needed to keep small
  },
  fieldName: {
    display: 'inline-block',
    minWidth: '90px',
    borderBottom: '1px solid #0003',
    backgroundColor: theme.palette.grey[200],
    marginRight: theme.spacing(1),
    padding: theme.spacing(0.5),
  },
  fieldValue: {
    display: 'inline-block',
    wordBreak: 'break-word',
    fontSize: '0.8em',
    maxHeight: 300,
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

const BaseCard: FunctionComponent<BaseCardProps> = props => {
  const classes = useStyles()
  const { children, title } = props
  return (
    <ExpansionPanel style={{ marginTop: '4px' }} defaultExpanded={true}>
      <ExpansionPanelSummary
        classes={{
          root: classes.root,
          expanded: classes.expanded,
          content: classes.content,
        }}
        expandIcon={<Icon>expand_more</Icon>}
      >
        <Typography variant="button"> {title}</Typography>
      </ExpansionPanelSummary>
      <ExpansionPanelDetails className={classes.expansionPanelDetails}>
        {children}
      </ExpansionPanelDetails>
    </ExpansionPanel>
  )
}
interface BaseProps extends BaseCardProps {
  feature: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}

const BaseCoreDetails = (props: BaseProps) => {
  const classes = useStyles()
  const { feature } = props
  const { refName, start, end, strand } = feature
  const strandMap: Record<number, string> = {
    '-1': '-',
    '0': '',
    '1': '+',
  }
  const strandStr = strandMap[strand] ? `(${strandMap[strand]})` : ''
  feature.length = end - start

  feature.position = `${refName}:${start + 1}..${end} ${strandStr}`

  return (
    <BaseCard {...props} title="Primary data">
      {coreRenderedDetails.map(key => {
        const value = feature[key.toLowerCase()]
        return (
          value && (
            <div key={key}>
              <div className={classes.fieldName}>{key}</div>
              <div className={classes.fieldValue}>{String(value)}</div>
            </div>
          )
        )
      })}
    </BaseCard>
  )
}

const omit = [
  'id',
  'name',
  'start',
  'end',
  'strand',
  'refName',
  'type',
  'length',
  'position',
]

interface AttributeProps {
  feature: Record<string, any>
}
const Attributes: FunctionComponent<AttributeProps> = props => {
  const classes = useStyles()
  const { feature } = props
  return (
    <>
      {Object.entries(feature)
        .filter(([k, v]) => v !== undefined && !omit.includes(k))
        .map(([key, value]) => (
          <div key={key}>
            <div className={classes.fieldName}>{key}</div>
            {isObject(value) ? (
              <div>
                <Attributes key={key} feature={value} />
              </div>
            ) : (
              <div className={classes.fieldValue}>{String(value)}</div>
            )}
          </div>
        ))}
    </>
  )
}
const BaseAttributes = (props: BaseProps) => {
  return (
    <BaseCard {...props} title="Attributes">
      <Attributes {...props} />
    </BaseCard>
  )
}

interface BaseInputProps extends BaseCardProps {
  model: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

const BaseFeatureDetails = (props: BaseInputProps) => {
  const classes = useStyles()
  const { model } = props
  const feat = JSON.parse(JSON.stringify(model.featureData))
  return (
    <Paper className={classes.paperRoot} data-testid="alignment-side-drawer">
      <BaseCoreDetails feature={feat} {...props} />
      <Divider />
      <BaseAttributes feature={feat} {...props} />
    </Paper>
  )
}

export default observer(BaseFeatureDetails)
