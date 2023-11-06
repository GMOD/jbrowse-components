import VCF from '@gmod/vcf'
import { assembleLocString } from '@jbrowse/core/util'

// locals
import LocString from './components/LocString'
import {
  launchBreakpointSplitView,
  launchLinearGenomeView,
  launchLinearGenomeViewWithEndFocus,
} from './util'
import { SpreadsheetModel } from '../models/Spreadsheet'
import { VcfFeature } from '@jbrowse/plugin-variants'

type Row = Record<string, unknown>

export function parseVcfBuffer(buffer: Buffer) {
  const str = new TextDecoder('utf8').decode(buffer)
  const lines = str
    .split(/\n|\r\n/)
    .map(f => f.trim())
    .filter(f => !!f)
  const headerLines = []
  let i = 0
  for (; i < lines.length && lines[i].startsWith('#'); i++) {
    headerLines.push(lines[i])
  }
  const header = headerLines.join('\n')
  const vcfParser = new VCF({ header })
  const keys = new Set<string>()
  const rows = lines.slice(i).map((l, id) => {
    const [CHROM, POS, ID, REF, ALT, QUAL, FILTER, INFO, FORMAT] = l.split('\t')
    const ret = Object.fromEntries(
      INFO?.split(';')
        .map(f => f.trim())
        .map(e => {
          const [key, val = 'true'] = e.split('=')
          const k = `INFO.${key.trim()}`
          keys.add(k)
          return [k, val.trim()]
        }) || [],
    )
    const feature = new VcfFeature({
      parser: vcfParser,
      variant: vcfParser.parseLine(l),
      id: `${id}`,
    })
    return {
      loc: assembleLocString({
        refName: feature.get('refName'),
        start: feature.get('start'),
        end: feature.get('end'),
      }),
      CHROM,
      POS,
      ID,
      REF,
      ALT,
      QUAL,
      FILTER,
      FORMAT,
      id,
      feature: new VcfFeature({
        parser: vcfParser,
        variant: vcfParser.parseLine(l),
        id: `${id}`,
      }),
      ___lineData: l,
      ...ret,
    }
  })

  return {
    vcfParser,
    rows,
    columns: [
      'loc',
      'CHROM',
      'POS',
      'ID',
      'REF',
      'ALT',
      'QUAL',
      'FILTER',
      'FORMAT',
      ...keys,
    ],
    CustomComponents: {
      loc: {
        Component: LocString,
        props: {
          getMenuItems: ({
            model,
            row,
          }: {
            model: SpreadsheetModel
            row: Row
          }) => [
            {
              label: 'Open in linear genome view (whole feature)',
              onClick: () =>
                launchLinearGenomeView({ model, value: row.loc as string }),
            },
            {
              label: 'Open in linear genome view (focused on ends of SV)',
              onClick: () => launchLinearGenomeViewWithEndFocus({ model, row }),
            },
            {
              label: 'Open in breakpoint split view',
              onClick: () =>
                launchBreakpointSplitView({ model, row, vcfParser }),
            },
          ],
        },
      },
    },
  }
}
