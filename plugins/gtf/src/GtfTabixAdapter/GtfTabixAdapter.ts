/* eslint-disable no-underscore-dangle */
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { doesIntersect2 } from '@jbrowse/core/util/range'
import { NoAssemblyRegion, Region } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { TabixIndexedFile } from '@gmod/tabix'
import { Observer, Observable } from 'rxjs'

import { Instance } from 'mobx-state-tree'
import { readConfObject } from '@jbrowse/core/configuration'
import MyConfigSchema from './configSchema'

type Strand = '+' | '-' | '.' | '?'
interface FeatureLoc {
  [key: string]: unknown
  seq_name: string
  source: string
  feature: string
  start: number
  end: number
  score: number
  strand: Strand
  frame: number
  attributes: { [key: string]: unknown[] }
}

export default class extends BaseFeatureDataAdapter {
  protected gtf: TabixIndexedFile | undefined

  public getRefNames(opts?: BaseOptions | undefined): Promise<string[]> {
    throw new Error("Method not implemented.")
  }
  public getFeatures(region: Region, opts?: BaseOptions | undefined): Observable<Feature> {
    throw new Error("Method not implemented.")
  }

  private formatFeatures(featureLocs: FeatureLoc[]) {
  }

  public freeResources(/* { region } */): void {}
}
