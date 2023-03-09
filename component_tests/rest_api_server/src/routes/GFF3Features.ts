import HttpStatusCodes from '../constants/HttpStatusCodes'

import { IReq, IRes } from './types/express/misc'

import { firstValueFrom, toArray } from 'rxjs'

import { Feature } from '@jbrowse/core/util'
import GFF3Adapter from '../../../../plugins/gff3/src/Gff3Adapter/Gff3Adapter'
import GFF3AdapterConfig from '../../../../plugins/gff3/src/Gff3Adapter/configSchema'

import FastaAdapter from '../../../../plugins/sequence/src/IndexedFastaAdapter/IndexedFastaAdapter'
import FastaAdapterConfig from '../../../../plugins/sequence/src/IndexedFastaAdapter/configSchema'

const assemblies = {
  volvox: {
    gff3: '../../test_data/volvox/volvox.sort.gff3',
    fasta: '../../test_data/volvox/volvox.fa',
    fai: '../../test_data/volvox/volvox.fa.fai',
  },
}

async function reference_sequences(req: IReq, res: IRes) {
  const { assemblyName } = req.params
  const assembly = assemblies[assemblyName as keyof typeof assemblies]
  if (!assembly) {
    res.status(HttpStatusCodes.NOT_FOUND).send('Assembly not found')
    return
  }
  const adapter = new FastaAdapter(
    FastaAdapterConfig.create({
      fastaLocation: {
        type: 'LocalPathLocation',
        localPath: assembly.fasta,
      },
      faiLocation: {
        type: 'LocalPathLocation',
        localPath: assembly.fai,
      },
    }),
  )

  const refnames = await adapter.getRefNames()
  return res.status(HttpStatusCodes.OK).json(refnames)
}

async function features(req: IReq, res: IRes) {
  const { assemblyName, refName } = req.params
  const { start, end } = req.query
  const assembly = assemblies[assemblyName as keyof typeof assemblies]
  if (!assembly) {
    res.status(404).send('Assembly not found')
    return
  }
  const adapter = new GFF3Adapter(
    GFF3AdapterConfig.create({
      gffLocation: {
        type: 'LocalPathLocation',
        localPath: assembly.gff3,
      },
    }),
  )
  const featureObservable = adapter.getFeatures({
    refName,
    start: Number(start),
    end: Number(end),
  })
  const features: Feature[] = await firstValueFrom(
    featureObservable.pipe(toArray()),
  )
  return res.status(HttpStatusCodes.OK).json({
    features,
  })
}

export default {
  features,
  reference_sequences,
} as const
