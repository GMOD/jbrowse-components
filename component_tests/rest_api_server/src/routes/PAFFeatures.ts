import HttpStatusCodes from '@src/constants/HttpStatusCodes';

import { IReq, IRes } from './types/express/misc';

import { firstValueFrom, toArray } from 'rxjs';

import { Feature } from '@jbrowse/core/util';
import PAFAdapter from '../../../../plugins/comparative-adapters/src/PAFAdapter/PAFAdapter'
import PAFAdapterConfig from '../../../../plugins/comparative-adapters/src/PAFAdapter/configSchema'

import FastaAdapter from '../../../../plugins/sequence/src/IndexedFastaAdapter/IndexedFastaAdapter'
import FastaAdapterConfig from '../../../../plugins/sequence/src/IndexedFastaAdapter/configSchema'
import { rsort } from 'semver';


const datasets = {
  grape_peach: {
    assemblyNames: ['peach', 'grape'],
    pafLocation: {
      "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/synteny/peach_grape.paf.gz",
      "locationType": "UriLocation"
    }
  }
}

function openDataset(name: string) {
  const ds = datasets[name as keyof typeof datasets]
  if(!ds)
    return
  const adapter = new PAFAdapter(PAFAdapterConfig.create(ds))
  return adapter
}

async function assembly_names(req: IReq, res: IRes) {
  const {datasetName} = req.params
  const paf = openDataset(datasetName)
  if(!paf) {
    res.status(404).send('Dataset not found')
    return
  }
  return res.status(HttpStatusCodes.OK).json(paf.getAssemblyNames())
}

async function has_data_for_reference(req: IReq, res: IRes) {
  return res.status(HttpStatusCodes.OK).json(true)
}

async function reference_sequences(req: IReq, res: IRes) {
  const {datasetName, assemblyName} = req.params
  const paf = openDataset(datasetName)
  if(!paf) {
    res.status(404).send('Dataset not found')
    return
  }
  return res.status(HttpStatusCodes.OK).json(await paf.getRefNames({ regions: [{assemblyName}] }))
}

async function features(req: IReq, res: IRes) {
  const {datasetName, assemblyName, refName } = req.params
  const { start, end } = req.query
  const paf = openDataset(datasetName)
  if(!paf) {
    res.status(404).send('Dataset not found')
    return
  }
  const featureObservable = paf.getFeatures({ assemblyName, refName, start: Number(start), end: Number(end) })
  const features: Feature[] = await firstValueFrom(featureObservable.pipe(toArray()))
  return res.status(HttpStatusCodes.OK).json({
    features
  });
}


export default {
  features,
  assembly_names,
  reference_sequences,
  has_data_for_reference,
} as const;
