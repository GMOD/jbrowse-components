/* eslint-disable @typescript-eslint/no-explicit-any,react/prop-types */
import Accordion from '@material-ui/core/Accordion'
import AccordionDetails from '@material-ui/core/AccordionDetails'
import AccordionSummary from '@material-ui/core/AccordionSummary'
import Typography from '@material-ui/core/Typography'
import ExpandMore from '@material-ui/icons/ExpandMore'
import Divider from '@material-ui/core/Divider'
import Paper from '@material-ui/core/Paper'
import Button from '@material-ui/core/Button'
import Tooltip from '@material-ui/core/Tooltip'
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import React, { useState, useEffect, FunctionComponent } from 'react'
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
  notExpanded?: boolean
}

export const BaseCard: FunctionComponent<BaseCardProps> = props => {
  const classes = useStyles()
  const { children, title, notExpanded } = props
  return (
    <Accordion style={{ marginTop: '4px' }} defaultExpanded={!notExpanded}>
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
  omit?: string[]
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

const omit = [
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

export const Attributes: FunctionComponent<AttributeProps> = props => {
  const classes = useStyles()
  const {
    attributes,
    omit: propOmit = [],
    formatter = (value: unknown) => (
      <SanitizedHTML
        html={isObject(value) ? JSON.stringify(value) : String(value)}
      />
    ),
    descriptions,
  } = props

  const SimpleValue = ({ name, value }: { name: string; value: any }) => {
    const description = descriptions && descriptions[name]
    return value ? (
      <div style={{ display: 'flex' }}>
        {description ? (
          <Tooltip title={description} placement="left">
            <div className={classes.fieldName}>{name}</div>
          </Tooltip>
        ) : (
          <div className={classes.fieldName}>{name}</div>
        )}
        <div className={classes.fieldValue}>{formatter(value)}</div>
      </div>
    ) : null
  }
  const ArrayValue = ({ name, value }: { name: string; value: any[] }) => {
    const description = descriptions && descriptions[name]
    return (
      <div style={{ display: 'flex' }}>
        {description ? (
          <Tooltip title={description} placement="left">
            <div className={classes.fieldName}>{name}</div>
          </Tooltip>
        ) : (
          <div className={classes.fieldName}>{name}</div>
        )}
        {value.map((val, i) => (
          <div key={`${name}-${i}`} className={classes.fieldSubvalue}>
            <SanitizedHTML
              html={isObject(val) ? JSON.stringify(val) : String(val)}
            />
          </div>
        ))}
      </div>
    )
  }

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

          return <SimpleValue key={key} name={key} value={value} />
        })}
    </>
  )
}

export const BaseAttributes = (props: BaseProps) => {
  const { feature, descriptions, title = 'Attributes' } = props
  return (
    <BaseCard {...props} title={title}>
      <Attributes {...props} attributes={feature} descriptions={descriptions} />
    </BaseCard>
  )
}

interface SubfeaturesToRenderProps {
  title: string
  attributes: Record<string, any>
}

/**
 * Recursively parse features to extract all subfeatures.
 * Return an subfeaturesToRender array of objects
 */
const getSubfeaturesToRender = (
  features: Record<string, any>,
  subfeaturesToRender: SubfeaturesToRenderProps[],
): SubfeaturesToRenderProps[] => {
  // Function who update subfeaturesToRender with the feature given, and recursively call
  // getSubfeaturesToRender for subfeature inside feature.
  const extractSubfeaturesToRender = (
    feature: Record<string, any>,
    subfeaturesToRenders: SubfeaturesToRenderProps[],
  ) => {
    let title = 'SubFeature'
    title = feature.type
    subfeaturesToRender.push({ title, attributes: feature })
    // If subfeatures are present in feature, recursively call getSubfeaturesToRender
    if ('subfeatures' in feature) {
      getSubfeaturesToRender(feature.subfeatures, subfeaturesToRenders)
    }
    return subfeaturesToRender
  }

  if (Array.isArray(features)) {
    for (const feature of features) {
      extractSubfeaturesToRender(feature, subfeaturesToRender)
    }
  } else if (features !== undefined) {
    extractSubfeaturesToRender(features, subfeaturesToRender)
  }

  return subfeaturesToRender
}

// Display a card named SUBFEATURES closed by default.
// When open, only card with information about transcript and mRNA are displayed,
// Accompanied with a button to load additionnal subfeature like exon/cds.
export const BaseSubFeatures = (props: BaseProps) => {
  const { feature, descriptions } = props
  const [subfeaturesLoaded, setSubfeaturesLoaded] = useState(false)
  const subfeaturesToRender = getSubfeaturesToRender(feature.subfeatures, [])

  // Reset subfeaturesLoaded on props change
  useEffect(() => {
    setSubfeaturesLoaded(false)
  }, [feature])

  return (
    <>
      {subfeaturesToRender.length > 0 && (
        <>
          <Divider />
          {subfeaturesLoaded ? (
            <BaseCard title="SubFeatures">
              {subfeaturesToRender.map((subfeature, idx) => {
                return (
                  <BaseAttributes
                    {...props}
                    key={idx}
                    title={subfeature.title}
                    feature={subfeature.attributes}
                    descriptions={descriptions}
                    notExpanded
                  />
                )
              })}
            </BaseCard>
          ) : (
            <Button
              variant="contained"
              color="secondary"
              style={{ margin: '5px' }}
              onClick={() => setSubfeaturesLoaded(true)}
            >
              Load Subfeatures
            </Button>
          )}
        </>
      )}
    </>
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
  const baseAttributesOmit = ['name', 'start', 'end']
  return (
    <Paper className={classes.paperRoot}>
      <BaseCoreDetails feature={feat} {...props} />
      <Divider />
      <BaseAttributes
        feature={feat}
        {...props}
        descriptions={descriptions}
        omit={baseAttributesOmit}
      />
      <BaseSubFeatures feature={feat} {...props} descriptions={descriptions} />
    </Paper>
  )
})
