import { formats } from '../../../../packages/add-track-core/src/formats.ts'
import { fileKind } from './configs.ts'

test('every format add-track opens names the file a reader needs', () => {
  const unnamed = formats
    .flatMap(({ spec }) => (spec.kind === 'unsupported' ? [] : [spec]))
    .map(spec => spec.adapterType)
    .filter(type => type !== 'SPARQLAdapter' && !fileKind(type))
  expect([...new Set(unnamed)]).toEqual([])
})
