/* eslint-disable @typescript-eslint/no-explicit-any,react/prop-types,no-nested-ternary */
import React, { useEffect, useState } from 'react'
import ErrorBoundary from 'react-error-boundary'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
  Divider,
  Tooltip,
  Select,
  MenuItem,
} from '@material-ui/core'
import ExpandMore from '@material-ui/icons/ExpandMore'
import { makeStyles } from '@material-ui/core/styles'
import { DataGrid } from '@material-ui/data-grid'
import { observer } from 'mobx-react'
import clsx from 'clsx'
import isObject from 'is-object'
import { getConf } from '../configuration'
import {
  measureText,
  getSession,
  defaultCodonTable,
  generateCodonTable,
  revcom,
} from '../util'
import { Feature } from '../util/simpleFeature'
import SanitizedHTML from '../ui/SanitizedHTML'

type Feat = { start: number; end: number; type: string }

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

  accordionBorder: {
    marginTop: '4px',
    border: '1px solid #444',
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
  prefix,
}: {
  description?: React.ReactNode
  name: string
  prefix?: string
}) => {
  const classes = useStyles()
  const val = (prefix ? `${prefix}.` : '') + name
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

function stitch(subfeats: Feat[], sequence: string) {
  return subfeats.map(sub => sequence.slice(sub.start, sub.end)).join('')
}

// filter if they have the same ID
function filterId(feat: Feat) {
  return `${feat.start}-${feat.end}`
}

// filters if successive elements share same start/end
function dedupe(list: Feat[]) {
  return list.filter(
    (item, pos, ary) => !pos || filterId(item) !== filterId(ary[pos - 1]),
  )
}

function revlist(list: Feat[], seqlen: number) {
  return list
    .map(sub => ({
      ...sub,
      start: seqlen - sub.end,
      end: seqlen - sub.start,
    }))
    .sort((a, b) => a.start - b.start)
}

const cdsColor = 'rgba(150,150,0,0.3)'
const utrColor = 'rgba(0,150,150,0.3)'
const proteinColor = 'rgba(150,0,150,0.3)'
const intronColor = 'rgba(200,200,200,0.3)'
const updownstreamColor = 'rgba(120,0,0,0.3)'

function GeneCDS(props: { cds: Feat[]; sequence: string }) {
  const { cds, sequence } = props

  return (
    <div
      style={{
        display: 'inline',
        backgroundColor: cdsColor,
      }}
    >
      {stitch(cds, sequence)}
    </div>
  )
}

function GeneProtein(props: {
  cds: Feat[]
  sequence: string
  codonTable: any
}) {
  const { cds, sequence, codonTable } = props
  const str = stitch(cds, sequence)
  let protein = ''
  for (let i = 0; i < str.length; i += 3) {
    // use & symbol for undefined codon, or partial slice
    protein += codonTable[str.slice(i, i + 3)] || '&'
  }
  return (
    <div
      style={{
        display: 'inline',
        backgroundColor: proteinColor,
      }}
    >
      {protein}
    </div>
  )
}

function GenecDNA(props: {
  utr: Feat[]
  cds: Feat[]
  exons: Feat[]
  sequence: string
  upstream?: string
  downstream?: string
  includeIntrons: boolean
  collapseIntron: boolean
}) {
  const {
    utr,
    cds,
    exons,
    sequence,
    upstream,
    downstream,
    includeIntrons,
    collapseIntron,
  } = props
  const firstCDS = cds[0]
  const lastCDS = cds[cds.length - 1]
  const fiveUTRs = utr.filter(elt => elt.end <= firstCDS.start)
  const threeUTRs = utr.filter(elt => elt.start >= lastCDS.end)
  return (
    <>
      {upstream ? (
        <div
          style={{
            display: 'inline',
            backgroundColor: updownstreamColor,
          }}
        >
          {upstream}
        </div>
      ) : null}
      <div
        style={{
          display: 'inline',
          backgroundColor: utrColor,
        }}
      >
        {fiveUTRs.map(c => sequence.slice(c.start, c.end)).join('')}
      </div>
      <>
        {(cds.length ? cds : exons).map((chunk, index) => {
          const intron = sequence.slice(chunk.end, cds[index + 1]?.start)
          return (
            <>
              <div
                style={{
                  display: 'inline',
                  backgroundColor: cdsColor,
                }}
              >
                {sequence.slice(chunk.start, chunk.end)}
              </div>
              {includeIntrons ? (
                <div
                  style={{
                    display: 'inline',
                    backgroundColor: intronColor,
                  }}
                >
                  {collapseIntron && intron.length > 20
                    ? `${intron.slice(0, 10)}...${intron.slice(-10)}`
                    : intron}
                </div>
              ) : null}
            </>
          )
        })}
      </>

      <div
        style={{
          display: 'inline',
          backgroundColor: utrColor,
        }}
      >
        {threeUTRs.map(c => sequence.slice(c.start, c.end)).join('')}
      </div>

      {downstream ? (
        <div
          style={{
            display: 'inline',
            backgroundColor: updownstreamColor,
          }}
        >
          {downstream}
        </div>
      ) : null}
    </>
  )
}

// calculates UTRs using impliedUTRs logic
function calculateUTRs(cds: Feat[], exons: Feat[]) {
  const firstCds = cds[0]
  const lastCds = cds[cds.length - 1]
  const firstCdsIdx = exons.findIndex(
    exon => exon.end >= firstCds.start && exon.start <= firstCds.start,
  )
  const lastCdsIdx = exons.findIndex(
    exon => exon.end >= lastCds.end && exon.start <= lastCds.end,
  )
  const lastCdsExon = exons[lastCdsIdx]
  const firstCdsExon = exons[firstCdsIdx]

  const fiveUTRs = [
    ...exons.slice(0, firstCdsIdx),
    { start: firstCdsExon.start, end: firstCds.start },
  ].map(elt => ({ ...elt, type: 'five_prime_UTR' }))

  const threeUTRs = [
    { start: lastCds.end, end: lastCdsExon.end },
    ...exons.slice(lastCdsIdx),
  ].map(elt => ({ ...elt, type: 'three_prime_UTR' }))

  return [...fiveUTRs, ...threeUTRs]
}

function SequencePanel(props: {
  sequence: { seq: string; upstream: string; downstream: string }
  feature: Feat & { strand: number; subfeatures: Feat[] }
  mode: string
}) {
  const { feature, mode } = props
  let {
    sequence: { seq: sequence, upstream, downstream },
  } = props
  const { subfeatures } = feature
  const codonTable = generateCodonTable(defaultCodonTable)

  const children = subfeatures
    .sort((a, b) => a.start - b.start)
    .map(sub => {
      return {
        ...sub,
        start: sub.start - feature.start,
        end: sub.end - feature.start,
      }
    })

  // we filter duplicate entries in cds and exon lists duplicate entries may
  // be rare but was seen in Gencode v36 track NCList, likely a bug on GFF3
  // or probably worth ignoring here (produces broken protein translations if
  // included)
  //
  // position 1:224,800,006..225,203,064 gene ENSG00000185842.15 first
  // transcript ENST00000445597.6
  //
  // http://localhost:3000/?config=test_data%2Fconfig.json&session=share-FUl7G1isvF&password=HXh5Y

  let cds = dedupe(children.filter(sub => sub.type === 'CDS'))
  let utr = dedupe(children.filter(sub => sub.type.match(/utr/i)))
  let exons = dedupe(children.filter(sub => sub.type === 'exon'))

  if (!utr.length && cds.length) {
    utr = calculateUTRs(cds, exons)
  }
  if (feature.strand === -1) {
    sequence = revcom(sequence)
    upstream = revcom(downstream)
    downstream = revcom(upstream)
    cds = revlist(cds, sequence.length)
    exons = revlist(exons, sequence.length)
    utr = revlist(utr, sequence.length)
  }

  if (mode === 'cds') {
    return <GeneCDS cds={cds} sequence={sequence} />
  }
  if (mode === 'cdna') {
    // utr's were supplied, no inference needed
    return <GenecDNA exons={exons} cds={cds} utr={utr} sequence={sequence} />
  }
  if (mode === 'protein') {
    return <GeneProtein cds={cds} codonTable={codonTable} sequence={sequence} />
  }

  if (mode === 'gene') {
    return (
      <GenecDNA
        exons={exons}
        cds={cds}
        utr={utr}
        sequence={sequence}
        includeIntrons
      />
    )
  }

  if (mode === 'gene_collapsed_intron') {
    return (
      <GenecDNA
        exons={exons}
        cds={cds}
        sequence={sequence}
        utr={utr}
        includeIntrons
        collapseIntron
      />
    )
  }

  if (mode === 'gene_updownstream') {
    return (
      <GenecDNA
        exons={exons}
        cds={cds}
        sequence={sequence}
        utr={utr}
        upstream={upstream}
        downstream={downstream}
        includeIntrons
      />
    )
  }
  return <div>Unknown type</div>
}

// display the stitched-together sequence of a gene's CDS, cDNA, or protein
// sequence. this is a best effort and weird genomic phenomena could lead these
// to not be 100% accurate
function SequenceFeatureDetails(props: BaseProps) {
  const { model, feature } = props
  const { assemblyManager, rpcManager } = getSession(model)
  const { assemblyNames } = model.view
  const subfeatures = feature.subfeatures as Feat[]
  const hasCDS = subfeatures.find(sub => sub.type === 'CDS')

  const [sequence, setSequence] = useState<{
    seq: string
    upstream: string
    downstream: string
  }>()
  const [error, setError] = useState<string>()
  const [mode, setMode] = useState(hasCDS ? 'cds' : 'cdna')
  const [assemblyName] = assemblyNames
  const loading = !sequence

  useEffect(() => {
    async function fetchSeq(start: number, end: number, refName: string) {
      const assembly = await assemblyManager.waitForAssembly(assemblyName)
      if (!assembly) {
        throw new Error('assembly not found')
      }
      const adapterConfig = getConf(assembly, ['sequence', 'adapter'])
      const sessionId = 'getSequence'
      const feats = await rpcManager.call(sessionId, 'CoreGetFeatures', {
        adapterConfig,
        sessionId,
        region: { start, end, refName: assembly?.getCanonicalRefName(refName) },
      })
      const [feat] = feats as Feature[]
      if (!feat) {
        throw new Error('sequence not found')
      }
      return feat.get('seq') as string
    }
    ;(async () => {
      try {
        const { start, end, refName: ref } = feature
        const seq = await fetchSeq(start, end, ref)
        const upstream = await fetchSeq(Math.max(0, start - 500), start, ref)
        const downstream = await fetchSeq(end, end + 500, ref)
        setSequence({ seq, upstream, downstream })
      } catch (e) {
        setError(e)
      }
    })()
  }, [feature, assemblyManager, rpcManager, assemblyName])

  return (
    <div>
      <Select
        value={mode}
        onChange={event => setMode(event.target.value as string)}
      >
        {hasCDS ? <MenuItem value="cds">CDS</MenuItem> : null}
        {hasCDS ? <MenuItem value="protein">Protein</MenuItem> : null}
        <MenuItem value="gene">Gene with introns</MenuItem>
        <MenuItem value="gene_collapsed_intron">
          Gene w/ +/- 10bp of intron
        </MenuItem>
        <MenuItem value="gene_updownstream">Gene +/- 500bp upstream</MenuItem>
        <MenuItem value="cdna">cDNA</MenuItem>
      </Select>
      <div style={{ display: 'inline' }}>
        {error ? (
          <Typography color="error">{error}</Typography>
        ) : loading ? (
          <div>Loading gene sequence...</div>
        ) : sequence ? (
          <div style={{ fontFamily: 'monospace', wordWrap: 'break-word' }}>
            <SequencePanel feature={feature} mode={mode} sequence={sequence} />
          </div>
        ) : (
          <div>No sequence found</div>
        )}
      </div>
    </div>
  )
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

function isEmpty(obj: Record<string, unknown>) {
  return Object.keys(obj).length === 0
}

export const BaseFeatureDetails = observer((props: BaseInputProps) => {
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

export const FeatureDetails = (props: {
  model: any
  feature: any
  depth?: number
  omit?: string[]
  formatter?: (val: unknown, key: string) => JSX.Element
}) => {
  const { model, feature, depth = 0 } = props
  const { name, id, type, subfeatures } = feature
  const displayName = name || id
  const ellipsedDisplayName =
    displayName && displayName.length > 20 ? '' : displayName
  const session = getSession(model)
  const defSeqTypes = ['mRNA', 'transcript']
  const sequenceTypes =
    getConf(session, ['featureDetails', 'sequenceTypes']) || defSeqTypes

  return (
    <BaseCard
      title={ellipsedDisplayName ? `${ellipsedDisplayName} - ${type}` : type}
    >
      <div>Core details</div>
      <CoreDetails {...props} />
      <Divider />
      <div>Attributes</div>
      <Attributes attributes={feature} {...props} />
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
