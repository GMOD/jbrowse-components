import { translateTranscript } from '@jbrowse/core/util/translateTranscript'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import GenbankSequenceAdapter from '../GenbankSequenceAdapter/GenbankSequenceAdapter.ts'
import sequenceConfigSchema from '../GenbankSequenceAdapter/configSchema.ts'
import GenbankAdapter from './GenbankAdapter.ts'
import configSchema from './configSchema.ts'

import type { Feature } from '@jbrowse/core/util'

function fixture(name: string) {
  return {
    localPath: require.resolve(`../test_data/${name}`),
    locationType: 'LocalPathLocation' as const,
  }
}

export function adapters(name: string) {
  return {
    features: new GenbankAdapter(
      configSchema.create({ genbankLocation: fixture(name) }),
    ),
    sequence: new GenbankSequenceAdapter(
      sequenceConfigSchema.create({ genbankLocation: fixture(name) }),
    ),
  }
}

export async function fetch(
  adapter: GenbankAdapter,
  refName: string,
  start: number,
  end: number,
  wholeAcrossOrigin?: boolean,
) {
  const found = await firstValueFrom(
    adapter
      .getFeatures({ refName, start, end }, { wholeAcrossOrigin })
      .pipe(toArray()),
  )
  return found.toSorted(
    (a, b) => a.get('start') - b.get('start') || b.get('end') - a.get('end'),
  )
}

export function shape(f: Feature): unknown[] {
  const subfeatures = f.get('subfeatures') ?? []
  return [
    f.get('type'),
    f.get('start'),
    f.get('end'),
    f.get('strand'),
    ...(f.get('phase') === undefined ? [] : [f.get('phase')]),
    ...(subfeatures.length ? [subfeatures.map(shape)] : []),
  ]
}

export async function protein(
  sequence: GenbankSequenceAdapter,
  refName: string,
  gene: Feature,
  length: number,
) {
  const seq = await sequence.getSequence({ refName, start: 0, end: length })
  return translateTranscript({
    transcript: gene,
    seq: `${seq}${seq}`.slice(gene.get('start'), gene.get('end')),
  })?.protein.replace(/\*$/, '')
}
