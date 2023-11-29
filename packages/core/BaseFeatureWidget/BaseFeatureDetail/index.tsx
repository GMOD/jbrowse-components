/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Divider,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { IAnyStateTreeNode } from 'mobx-state-tree'

// icons
import ExpandMore from '@mui/icons-material/ExpandMore'

// locals
import {
  getEnv,
  getSession,
  assembleLocString,
  ParsedLocString,
} from '../../util'
import { ErrorMessage } from '../../ui'
import SequenceFeatureDetails from '../SequenceFeatureDetails'
import { BaseCardProps, BaseProps } from '../types'
import { SimpleFeatureSerialized } from '../../util'
import SimpleField from './SimpleField'
import Attributes from './Attributes'
import { generateTitle, isEmpty, toLocale } from './util'

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

const useStyles = makeStyles()(theme => ({
  expansionPanelDetails: {
    display: 'block',
    padding: theme.spacing(1),
  },
  expandIcon: {
    color: theme.palette.tertiary?.contrastText || '#fff',
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
      TransitionProps={{ unmountOnExit: true, timeout: 150 }}
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

function Position(props: BaseProps) {
  const { feature } = props
  const strand = feature.strand as number
  const strandMap: Record<string, string> = {
    '-1': '-',
    '0': '',
    '1': '+',
  }
  const str = strandMap[strand] ? `(${strandMap[strand]})` : ''
  // @ts-expect-error
  const loc = assembleLocString(feature as ParsedLocString)
  return <>{`${loc} ${str}`}</>
}

function CoreDetails(props: BaseProps) {
  const { feature } = props
  const obj = feature as SimpleFeatureSerialized & {
    start: number
    end: number
    assemblyName?: string
    strand: number
    refName: string
    __jbrowsefmt: {
      start?: number
      assemblyName?: string
      end?: number
      refName?: string
      name?: string
    }
  }

  // eslint-disable-next-line no-underscore-dangle
  const formattedFeat = { ...obj, ...obj.__jbrowsefmt }
  const { start, end } = formattedFeat

  const displayedDetails: Record<string, any> = {
    ...formattedFeat,
    length: toLocale(end - start),
  }

  const coreRenderedDetails = {
    description: 'Description',
    name: 'Name',
    length: 'Length',
    type: 'Type',
  }
  return (
    <>
      <SimpleField
        name="Position"
        value={<Position {...props} feature={formattedFeat} />}
      />
      {Object.entries(coreRenderedDetails)
        .map(([key, name]) => [name, displayedDetails[key]])
        .filter(([, value]) => value != null)
        .map(([name, value]) => (
          <SimpleField key={name} name={name} value={value} />
        ))}
    </>
  )
}

export const BaseCoreDetails = (props: BaseProps) => {
  const { title = 'Primary data' } = props
  return (
    <BaseCard {...props} title={title}>
      <CoreDetails {...props} />
    </BaseCard>
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

interface PanelDescriptor {
  name: string
  Component: React.FC<any>
}

export function FeatureDetails(props: {
  model: IAnyStateTreeNode
  feature: SimpleFeatureSerialized
  depth?: number
  omit?: string[]
  descriptions?: Record<string, React.ReactNode>
  formatter?: (val: unknown, key: string) => React.ReactNode
}) {
  const { omit = [], model, feature, depth = 0 } = props
  const { maxDepth } = model
  const { mate, name = '', id = '', type = '', subfeatures, uniqueId } = feature
  const pm = getEnv(model).pluginManager
  const session = getSession(model)

  const ExtraPanel = pm.evaluateExtensionPoint('Core-extraFeaturePanel', null, {
    session,
    feature,
    model,
  }) as PanelDescriptor | undefined
  return (
    <BaseCard title={generateTitle(name, id, type)}>
      <Typography>Core details</Typography>
      <CoreDetails {...props} />
      {mate ? (
        <>
          <Divider />
          <Typography>Mate details</Typography>
          <CoreDetails
            {...props}
            feature={{ ...mate, uniqueId: uniqueId + '-mate' }}
          />
        </>
      ) : null}

      <Divider />
      <Typography>Attributes</Typography>
      <Attributes
        attributes={feature}
        {...props}
        omit={omit}
        omitSingleLevel={coreDetails}
      />

      <ErrorBoundary FallbackComponent={e => <ErrorMessage error={e.error} />}>
        <SequenceFeatureDetails {...props} />
      </ErrorBoundary>

      {ExtraPanel ? (
        <>
          <Divider />
          <BaseCard title={ExtraPanel.name}>
            <ExtraPanel.Component {...props} />
          </BaseCard>
        </>
      ) : null}

      {depth < maxDepth && subfeatures?.length ? (
        <BaseCard title="Subfeatures" defaultExpanded={depth < 1}>
          {subfeatures.map((sub, idx) => (
            <FeatureDetails
              key={JSON.stringify(sub)}
              feature={{ ...sub, uniqueId: `${uniqueId}_${idx}` }}
              model={model}
              depth={depth + 1}
            />
          ))}
        </BaseCard>
      ) : null}
    </BaseCard>
  )
}

const BaseFeatureDetail = observer(function ({ model }: BaseInputProps) {
  const { error, featureData } = model

  if (error) {
    return <ErrorMessage error={error} />
  }
  if (!featureData) {
    return null
  }

  // replacing undefined with null helps with allowing fields to be hidden,
  // setting null is not allowed by jexl so we set it to undefined to hide. see
  // config guide. this replacement happens both here and when snapshotting the
  // featureData
  const g = JSON.parse(
    JSON.stringify(featureData, (_, v) => (v === undefined ? null : v)),
  )
  return isEmpty(g) ? null : <FeatureDetails model={model} feature={g} />
})

export default BaseFeatureDetail

export { default as Attributes } from './Attributes'
