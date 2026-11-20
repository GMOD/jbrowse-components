import { SequenceFeatureDetailsF } from '../model.ts'
import { sequenceSettingsMenuItems } from './sequenceSettingsMenu.ts'

import type { SequenceDisplayMode } from '../model.ts'

type Model = ReturnType<ReturnType<typeof SequenceFeatureDetailsF>['create']>

function labels(mode: SequenceDisplayMode, setup = (_: Model) => {}) {
  const model = SequenceFeatureDetailsF().create()
  setup(model)
  return sequenceSettingsMenuItems({
    model,
    mode,
    revcomp: false,
    setRevcomp: () => {},
  }).map(item => ('label' in item ? item.label : item.type))
}

afterEach(() => {
  localStorage.clear()
})

test('a spliced type offers only casing and coordinates', () => {
  expect(labels('cdna')).toEqual(['Capitalize CDS', 'Show coordinates'])
  expect(labels('protein')).toEqual(['Show coordinates'])
})

test('each length slider shows only for the types whose label names it', () => {
  expect(labels('gene')).toEqual([
    'Reverse complement',
    'Capitalize CDS',
    'Show coordinates',
  ])
  expect(labels('gene_collapsed_intron')).toEqual([
    'Reverse complement',
    'Intron bases',
    'Capitalize CDS',
    'Show coordinates',
  ])
  expect(labels('gene_updownstream_collapsed_intron')).toEqual([
    'Reverse complement',
    'Intron bases',
    'Flanking bases',
    'Capitalize CDS',
    'Show coordinates',
  ])
  expect(labels('genomic_sequence_updownstream')).toEqual([
    'Reverse complement',
    'Flanking bases',
    'Show coordinates',
  ])
})

test('the row width shows while coordinates cut the readout into rows', () => {
  expect(
    labels('cds', m => {
      m.setShowCoordinates('relative')
    }),
  ).toEqual(['Capitalize CDS', 'Show coordinates', 'Bases per row'])
})
