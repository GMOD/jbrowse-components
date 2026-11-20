import { makeSizeSubMenu } from '../../../ui/makeSizeMenu.tsx'
import { resolveShowCoordinates } from '../featureTypeUtil.ts'
import {
  DEFAULT_CHARACTERS_PER_ROW,
  DEFAULT_INTRON_BP,
  DEFAULT_UP_DOWN_BP,
} from '../model.ts'
import { sequenceModes } from '../sequenceModes.ts'

import type { MenuItem } from '../../../ui/index.ts'
import type {
  SequenceDisplayMode,
  SequenceFeatureDetailsModel,
  ShowCoordinatesMode,
} from '../model.ts'

const bp = (n: number) => `${n}bp`

/**
 * The sequence panel's settings, each row present only where the picked
 * sequence type reads it: the intron length for the "w/ Nbp intron" types, the
 * flank length for the "+/- Nbp" ones, and the row width while coordinates cut
 * the readout into rows. The type's label in the dropdown names the length the
 * slider sets. The flank length commits on release because it refetches.
 */
export function sequenceSettingsMenuItems({
  model,
  mode,
  revcomp,
  setRevcomp,
}: {
  model: SequenceFeatureDetailsModel
  mode: SequenceDisplayMode
  revcomp: boolean
  setRevcomp: (arg: boolean) => void
}): MenuItem[] {
  const traits = sequenceModes[mode]
  const { intronBp, upDownBp, upperCaseCDS, charactersPerRow } = model
  // the radio reflects what the panel renders, not the raw stored setting: a
  // sticky 'genomic' preference renders as relative in modes that can't label
  // genomic positions, and would otherwise leave every radio unchecked
  const coordinatesMode = resolveShowCoordinates(
    model.showCoordinatesSetting,
    mode,
  )
  const coordinatesRadio = (label: string, value: ShowCoordinatesMode) => ({
    label,
    type: 'radio' as const,
    checked: coordinatesMode === value,
    onClick: () => {
      model.setShowCoordinates(value)
    },
  })
  return [
    ...(traits.revcomp
      ? [
          {
            label: 'Reverse complement',
            type: 'checkbox' as const,
            checked: revcomp,
            onClick: () => {
              setRevcomp(!revcomp)
            },
          },
        ]
      : []),
    ...(traits.collapsedIntrons
      ? [
          makeSizeSubMenu({
            label: 'Intron bases',
            title: 'Intron bases',
            getValue: () => model.intronBp,
            min: 1,
            max: 1000,
            scale: 'log',
            format: bp,
            isDefault: intronBp === DEFAULT_INTRON_BP,
            onChange: n => {
              model.setIntronBp(n)
            },
            onReset: () => {
              model.setIntronBp(DEFAULT_INTRON_BP)
            },
          }),
        ]
      : []),
    ...(traits.upDownstream
      ? [
          makeSizeSubMenu({
            label: 'Flanking bases',
            title: 'Flanking bases',
            getValue: () => model.upDownBp,
            min: 1,
            max: 20000,
            scale: 'log',
            format: bp,
            commitOnRelease: true,
            isDefault: upDownBp === DEFAULT_UP_DOWN_BP,
            onChange: n => {
              model.setUpDownBp(n)
            },
            onReset: () => {
              model.setUpDownBp(DEFAULT_UP_DOWN_BP)
            },
          }),
        ]
      : []),
    ...(traits.seqtype === 'cds' || traits.seqtype === 'cdna'
      ? [
          {
            label: 'Capitalize CDS',
            type: 'checkbox' as const,
            checked: upperCaseCDS,
            onClick: () => {
              model.setUpperCaseCDS(!upperCaseCDS)
            },
          },
        ]
      : []),
    {
      label: 'Show coordinates',
      type: 'subMenu',
      subMenu: [
        coordinatesRadio('No coordinates', 'none'),
        coordinatesRadio('Coordinates relative to feature start', 'relative'),
        {
          ...coordinatesRadio('Coordinates relative to genome', 'genomic'),
          disabled: !traits.genomicCoords,
          disabledHelpText:
            'Only available for continuous genome based sequence types',
        },
      ],
    },
    ...(model.showCoordinates
      ? [
          makeSizeSubMenu({
            label: 'Bases per row',
            title: 'Bases per row',
            getValue: () => model.charactersPerRow,
            min: 10,
            max: 300,
            step: 10,
            format: n => `${n}`,
            isDefault: charactersPerRow === DEFAULT_CHARACTERS_PER_ROW,
            onChange: n => {
              model.setCharactersPerRow(n)
            },
            onReset: () => {
              model.setCharactersPerRow(DEFAULT_CHARACTERS_PER_ROW)
            },
          }),
        ]
      : []),
  ]
}
