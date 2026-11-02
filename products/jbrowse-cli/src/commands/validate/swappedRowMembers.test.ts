/**
 * @jest-environment node
 */
import { schemaProblems } from './schemaValidate.ts'

function problems(rows: Record<string, unknown>) {
  return schemaProblems({
    assemblies: [
      {
        name: 'hg38',
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: 'hg38-ref',
          adapter: { type: 'BgzipFastaAdapter', uri: 'hg38.fa.gz' },
        },
      },
    ],
    tracks: [
      {
        type: 'VariantTrack',
        trackId: 'calls',
        name: 'Calls',
        assemblyNames: ['hg38'],
        adapter: { type: 'VcfTabixAdapter', uri: 'calls.vcf.gz' },
        displays: [{ type: 'LinearVariantDisplay', rows }],
      },
    ],
  }).map(({ message }) => message)
}

// A member written where its same-word sibling belongs is reported with the
// member's meaning, which names the sibling (ADR-257).
test.each([
  ['color', { NA12878: 'red' }, 'rows.colors'],
  ['colors', 'population', 'rows.color'],
  ['labels', false, 'rows.axis.labels'],
  ['tree', false, 'rows.axis.tree'],
])('rows.%s %j is reported naming %s', (member, value, sibling) => {
  const messages = problems({ [member]: value })
  expect(messages.length).toBeGreaterThan(0)
  expect(messages.every(message => message.includes(sibling))).toBe(true)
})
