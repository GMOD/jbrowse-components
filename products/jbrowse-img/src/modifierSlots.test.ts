/**
 * The track modifiers and the README's modifier tables write config slots by
 * hand, so each write goes through the committed schema here: a respelled
 * slot fails this file instead of leaving a modifier that writes nothing.
 */
import fs from 'node:fs'
import path from 'node:path'

import {
  ALL_CATEGORIES,
  buildDisplaySnapshot,
  categorizedDisplayTypes,
  displayCategory,
  memberPatch,
  memberWrites,
  trackModifierNames,
} from '@jbrowse/launch-args/displaySettings'

import { slotPathsByType } from '../../../scripts/configSlotPaths.ts'
import { configManifest } from '../../jbrowse-cli/src/commands/validate/configManifest.generated.ts'
import { configJsonSchema } from '../../jbrowse-cli/src/commands/validate/configSchema.generated.ts'
import { schemaProblems } from '../../jbrowse-cli/src/commands/validate/schemaValidate.ts'

import type { Category } from '@jbrowse/launch-args/displaySettings'

const defs = configJsonSchema.$defs as Record<string, unknown>
const pathsByType = slotPathsByType(configJsonSchema)
const displayTypes = Object.keys(configManifest.displays)
const viewTypes = Object.keys(configManifest.views)

const displaysOf = (category: Category) =>
  categorizedDisplayTypes.filter(type => displayCategory(type) === category)

const fits = (data: object, pointer: string) =>
  schemaProblems(data, pointer).length === 0

// a setting is a config slot or a display's own state
function displayTaking(types: readonly string[], settings: object) {
  return types.find(type =>
    [type, `${type}Snapshot`].some(
      def => def in defs && fits({ type, ...settings }, `/$defs/${def}`),
    ),
  )
}

const READ_FIELDS = [
  'strand',
  'firstOfPairStrand',
  'mapq',
  'insertSize',
  'pairOrientation',
  'insertSizeAndOrientation',
  'mateRefName',
  'mateAssembly',
]

const SAMPLES: Record<string, string[] | Partial<Record<Category, string[]>>> =
  {
    height: ['80'],
    force: ['true', 'false'],
    display: ['marks', 'multivariant', 'multivariantmatrix'],
    index: ['reads.bam.csi'],
    name: ['Tumor'],
    heightMode: ['fixed', 'grow', 'fit:200'],
    featureHeight: ['normal', 'compact', 'super-compact', '4'],
    sort: ['position', 'strand', 'basePair', 'tag:HP'],
    arcs: ['off', 'up', 'down', 'cloud'],
    sashimi: ['off', 'up', 'down', 'auto'],
    spliced: ['all', 'only', 'exclude'],
    svSignal: ['all', 'only', 'exclude'],
    alone: ['all', 'only', 'exclude'],
    split: ['all', 'only', 'exclude'],
    flags: ['SECONDARY,DUP:QCFAIL', ':256'],
    mapq: ['20'],
    filterTag: ['HP', 'HP:1'],
    baseColor: [
      'modifications',
      'methylation',
      'bisulfite',
      'baseQuality',
      'base',
    ],
    color: {
      alignments: ['red', ...READ_FIELDS],
      wiggle: ['red'],
      feature: ['red', 'strand'],
      variant: ['red', 'strand'],
      hic: ['viridis'],
      other: ['red'],
    },
  }

// The displays a modifier writes nothing on, by modifier
const WRITES_NOTHING: Record<string, readonly string[]> = {
  // runBatch hands every track `force:true`; these have no size gate to lift
  force: [
    'LinearWiggleDisplay',
    'LinearHicDisplay',
    'LDTrackDisplay',
    'LinearSyntenyDisplay',
    'DotplotDisplay',
    'ChordSyntenyDisplay',
    'ChordVariantDisplay',
  ],
  // the comparative views size these
  height: [
    'LinearSyntenyDisplay',
    'DotplotDisplay',
    'ChordSyntenyDisplay',
    'ChordVariantDisplay',
  ],
  color: [
    'LDTrackDisplay',
    'LinearReferenceSequenceDisplay',
    'LinearSyntenyDisplay',
    'DotplotDisplay',
    'ChordSyntenyDisplay',
  ],
  // gaps: `display:multivariant heightMode:grow` writes nothing
  heightMode: [
    'LinearMultiRowFeatureDisplay',
    'LinearMultiSampleVariantDisplay',
  ],
  featureHeight: [
    'LinearMultiRowFeatureDisplay',
    'LinearMultiSampleVariantDisplay',
  ],
}

const writesNothing = (name: string, type: string) =>
  WRITES_NOTHING[name]?.includes(type) ?? false

const samplesFor = (name: string, category: Category) => {
  const samples = SAMPLES[name] ?? []
  return Array.isArray(samples) ? samples : (samples[category] ?? [])
}

test('every named modifier has samples', () => {
  expect(Object.keys(SAMPLES).sort()).toEqual([...trackModifierNames].sort())
})

test('every display a category names is one the schema declares', () => {
  expect(
    categorizedDisplayTypes.filter(type => !displayTypes.includes(type)),
  ).toEqual([])
})

function modifierRefusals(name: string) {
  const refused = new Set<string>()
  let applied = 0
  for (const category of ALL_CATEGORIES) {
    for (const sample of samplesFor(name, category)) {
      const opt = `${name}:${sample}`
      const warnings: string[] = []
      const result = buildDisplaySnapshot(category, [opt], message => {
        warnings.push(message)
      })
      if (warnings.length > 0) {
        continue
      }
      applied += 1
      const members = memberWrites(category, [opt])
      const settings = {
        ...result.snap,
        ...(result.sort
          ? { sort: { ...result.sort, pos: 0, refName: 'chr1' } }
          : {}),
        ...(members.length ? memberPatch(members, () => undefined) : {}),
      }
      const types = result.displayType
        ? [result.displayType]
        : displaysOf(category)
      for (const type of types) {
        if (!displayTaking([type], settings)) {
          refused.add(type)
        }
      }
    }
  }
  return { refused: [...refused], applied }
}

describe('each modifier writes settings every display of its category takes', () => {
  for (const name of trackModifierNames) {
    it(name, () => {
      const { refused, applied } = modifierRefusals(name)
      expect(refused.filter(type => !writesNothing(name, type))).toEqual([])
      expect(applied).toBeGreaterThan(0)
    })
  }
})

test('every display a modifier is listed as writing nothing on refuses it', () => {
  const stale = Object.entries(WRITES_NOTHING).flatMap(([name, types]) => {
    const { refused } = modifierRefusals(name)
    return types
      .filter(type => !refused.includes(type))
      .map(t => `${name} ${t}`)
  })
  expect(stale).toEqual([])
})

const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8')

const WRITE = /^([A-Za-z_][\w.]*)=(\S*)$/

// `path=value`, `key=value` and `slot.path=value` name the form, not a slot
function readmeWrites() {
  const spans = [...readme.matchAll(/`([^`\n]+)`/g)].map(m => m[1]!)
  const fenced = [...readme.matchAll(/```bash\n([\s\S]*?)```/g)].flatMap(m =>
    m[1]!.split(/\s+/),
  )
  return [
    ...new Set(
      [...spans, ...fenced].filter(
        token => WRITE.test(token) && !token.endsWith('=value'),
      ),
    ),
  ]
}

const isPlaceholder = (value: string) =>
  value === '' || value.includes('<') || /^[A-Z]$/.test(value)

// a digit segment indexes the list the path before it names
const slotOf = (lhs: string) =>
  lhs.replace(/\.\d+$/, '').replaceAll(/\.\d+(?=\.)/g, '[]')

function readmeRefusal(write: string) {
  const [, lhs = '', value = ''] = WRITE.exec(write)!
  const slot = slotOf(lhs)
  if (isPlaceholder(value) || /\.\d/.test(lhs)) {
    return displayTypes.some(type => pathsByType.get(type)?.has(slot))
      ? undefined
      : `${write}: no display declares ${slot}`
  }
  const settings = memberPatch([write], () => undefined)
  return displayTaking(displayTypes, settings) ||
    viewTypes.some(type => fits({ type, ...settings }, '/$defs/View'))
    ? undefined
    : `${write}: no display or view takes ${JSON.stringify(settings)}`
}

test('every slot write the README names is one a display or view takes', () => {
  const writes = readmeWrites()
  expect(writes.flatMap(write => readmeRefusal(write) ?? [])).toEqual([])
  expect(writes.length).toBeGreaterThan(20)
})

test('the README tables document every named modifier and no other', () => {
  const documented = new Set(
    [...readme.matchAll(/^\| `(\w+):/gm)].map(m => m[1]!),
  )
  expect([...documented].sort()).toEqual([...trackModifierNames].sort())
})
