import { readConfObject } from '@jbrowse/core/configuration'
import { stripAlpha } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import Arrow from './Arrow'
import Box from './Box'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { SceneGraph } from '@jbrowse/core/util/layouts'

const map = {
  CACTA_TIR_transposon: '#e6194b',
  centromeric_repeat: '#3cb44b',
  Copia_LTR_retrotransposon: '#118119',
  Gypsy_LTR_retrotransposon: '#4363d8',
  hAT_TIR_transposon: '#f58231',
  helitron: '#911eb4',
  knob: '#46f0f0',
  L1_LINE_retrotransposon: '#f032e6',
  LINE_element: '#bcf60c',
  long_terminal_repeat: '#fb0',
  low_complexity: '#008080',
  LTR_retrotransposon: '#e6beff',
  Mutator_TIR_transposon: '#9a6324',
  PIF_Harbinger_TIR_transposon: '#fffac8',
  rDNA_intergenic_spacer_element: '#800000',
  repeat_region: '#aaffc3',
  RTE_LINE_retrotransposon: '#808000',
  subtelomere: '#ffd8b1',
  target_site_duplication: '#000075',
  Tc1_Mariner_TIR_transposon: '#808080',
}

const Segments = observer(function Segments(props: {
  region: Region
  feature: Feature
  featureLayout: SceneGraph
  config: AnyConfigurationModel
  selected?: boolean
  reversed?: boolean
  subfeatures?: Feature[]
  children?: React.ReactNode
  bpPerPx: number
  colorByCDS: boolean
}) {
  const {
    feature,
    featureLayout,
    selected,
    config,
    // some subfeatures may be computed e.g. makeUTRs,
    // so these are passed as a prop, or feature.get('subfeatures') by default
    subfeatures = feature.get('subfeatures'),
  } = props

  const theme = useTheme()
  const c = readConfObject(config, 'color2', { feature })
  const color2 = c === '#f0f' ? stripAlpha(theme.palette.text.secondary) : c

  const { left = 0, top = 0, width = 0, height = 0 } = featureLayout.absolute

  const y = top + height / 2
  return (
    <>
      <line
        data-testid={feature.id()}
        x1={left}
        y1={y}
        y2={y}
        x2={left + width}
        stroke={color2}
      />
      {subfeatures
        ?.sort((a, b) => {
          if (a.get('type').endsWith('_retrotransposon')) {
            return -1
          } else if (b.get('type').endsWith('_retrotransposon')) {
            return 1
          } else {
            return 0
          }
        })
        .map(subfeature => {
          const subfeatureId = String(subfeature.id())
          const subfeatureLayout = featureLayout.getSubRecord(subfeatureId)
          // This subfeature got filtered out
          if (!subfeatureLayout) {
            return null
          }
          const type = subfeature.get('type')
          const color = map[type as keyof typeof map] || '#000'
          return (
            <Box
              key={`glyph-${subfeatureId}`}
              {...props}
              feature={subfeature}
              topLevel={false}
              color={color}
              featureLayout={subfeatureLayout}
              selected={selected}
              shorten={type.endsWith('_retrotransposon')}
            />
          )
        })}
      <Arrow {...props} />
    </>
  )
})

export default Segments
