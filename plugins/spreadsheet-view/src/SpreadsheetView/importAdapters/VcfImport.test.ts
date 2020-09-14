import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { TextDecoder, TextEncoder } from 'fastestsmallesttextencoderdecoder'
import { promises as fsPromises } from 'fs'
import path from 'path'
import { parseVcfBuffer, splitVcfFileHeaderAndBody } from './VcfImport'

window.TextEncoder = TextEncoder
window.TextDecoder = TextDecoder

const pluginManager = new PluginManager()
const SpreadsheetModel = pluginManager.jbrequire(
  require('../models/Spreadsheet'),
)

describe('vcf file splitter', () => {
  const cases: [string, {}][] = [
    [
      '##fileformat=VCFv4.3\nfogbat\n',
      { header: '##fileformat=VCFv4.3\n', body: 'fogbat\n' },
    ],
    [
      '##fileformat=VCFv4.3\n##zonker\n##deek\n##donk\nfogbat\n',
      {
        header: '##fileformat=VCFv4.3\n##zonker\n##deek\n##donk\n',
        body: 'fogbat\n',
      },
    ],
  ]

  cases.forEach(([input, output], caseNumber) => {
    test(`case ${caseNumber}`, () => {
      expect(splitVcfFileHeaderAndBody(input)).toEqual(output)
    })
  })
})

test('vcf file import', async () => {
  const filepath = path.join(
    __dirname,
    '..',
    'test_data',
    '1801160099-N32519_26611_S51_56704.hard-filtered.vcf',
  )
  const buf = await fsPromises.readFile(filepath)
  const spreadsheetSnap = parseVcfBuffer(buf)
  expect(spreadsheetSnap).toMatchSnapshot()
  const spreadsheet = SpreadsheetModel.create(spreadsheetSnap)
  expect(spreadsheet.rowSet.rows.length).toBe(101)
})
