import {
  addDisposer,
  getParent,
  types,
  Instance,
  getSnapshot,
} from 'mobx-state-tree'
import { autorun, observable, toJS } from 'mobx'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  createTextSearchConf,
  findTrackConfigsToIndex,
} from '@jbrowse/text-indexing'

interface Track {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}
interface TrackTextIndexing {
  attributes: string[]
  exclude: string[]
  assemblies: string[]
  tracks: string[] // trackIds
  indexType: string
}

type jobType = 'indexing' | 'test'
export interface JobsEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any
  progressPct?: number
  name: string
  statusMessage?: string
  cancelCallback?: () => void
  jobType?: jobType
}
export default function jobsModelFactory(pluginManager: PluginManager) {
  return types
    .model('JobsManager', {})
    .volatile(() => ({
      status: 0 as number,
      running: false,
      statusMessage: '',
      abort: false,
      jobsQueue: observable.array([] as JobsEntry[]),
      finishedJobs: observable.array([] as JobsEntry[]),
      controller: new AbortController(),
    }))
    .views(self => ({
      get rpcManager() {
        return getParent(self).jbrowse.rpcManager
      },
      get tracks() {
        return getParent(self).jbrowse.tracks
      },
      get sessionPath() {
        return getParent(self).sessionPath
      },
      get signal() {
        return self.controller.signal
      },
      get session() {
        return getParent(self).session
      },
      get aggregateTextSearchAdapters() {
        return getParent(self).jbrowse.aggregateTextSearchAdapters
      },
    }))
    .actions(self => ({
      setRunning(running: boolean) {
        self.running = running
      },
      setStatus(arg: string) {
        const progress = +arg
        if (isNaN(progress)) {
          this.setStatusMessage(arg)
        } else {
          self.status = progress
        }
      },
      setStatusMessage(arg: string) {
        self.statusMessage = arg
      },
      addFinishedJob(entry: JobsEntry) {
        self.finishedJobs.push(entry)
      },
      queueJob(props: JobsEntry) {
        self.jobsQueue.push(props)
      },
      dequeueJob() {
        const entry = self.jobsQueue.splice(0, 1)[0]
        return entry
      },
      async runIndexingJob(entry: JobsEntry) {
        const {
          tracks: trackIds,
          exclude,
          attributes,
          assemblies,
          indexType,
        } = toJS(entry.params as TrackTextIndexing)
        const rpcManager = self.rpcManager
        const trackConfigs = findTrackConfigsToIndex(self.tracks, trackIds).map(
          conf => {
            return JSON.parse(JSON.stringify(getSnapshot(conf)))
          },
        )
        try {
          this.setRunning(true)
          const result = rpcManager.call(
            'indexTracksSessionId',
            'TextIndexRpcMethod',
            {
              tracks: trackConfigs,
              attributes,
              exclude,
              assemblies,
              indexType,
              outLocation: self.sessionPath,
              sessionId: 'indexTracksSessionId',
              statusCallback: (message: string) => {
                this.setStatus(message)
              },
              signal: self.signal,
              timeout: 1000 * 60 * 60 * 1000, // 1000 hours, avoid user ever running into this
            },
          )
          await result
          if (indexType === 'perTrack') {
            // should update the single track conf
            trackIds.forEach(trackId => {
              this.addTrackTextSearchConf(
                trackId,
                assemblies,
                attributes,
                exclude,
              )
              self.session?.notify(
                `Succesfully indexed track with trackId: ${trackId} `,
                'success',
              )
            })
          } else {
            assemblies.forEach(assemblyName => {
              const indexedTrackIds = trackConfigs
                .filter(track =>
                  assemblyName
                    ? track.assemblyNames.includes(assemblyName)
                    : true,
                )
                .map(trackConf => trackConf.trackId)
              this.addAggregateTextSearchConf(indexedTrackIds, assemblyName)
              self.session?.notify(
                `Succesfully indexed assembly: ${assemblyName} `,
                'success',
              )
            })
          }
          const current = this.dequeueJob()
          current && this.addFinishedJob(current)
        } catch (e) {
          self.session?.notify(
            `An error occurred while indexing: ${e}`,
            'error',
            {
              name: 'Retry',
              onClick: () => {
                this.queueJob(entry)
              },
            },
          )
          this.dequeueJob()
        }
        this.setRunning(false)
        this.setStatus('')
        this.setStatusMessage('')
        return
      },
      async runJob() {
        if (self.jobsQueue.length) {
          const firstIndexingJob = self.jobsQueue[0] as JobsEntry
          const { jobType } = firstIndexingJob
          jobType &&
            jobType === 'indexing' &&
            this.runIndexingJob(firstIndexingJob)
        }
        return
      },
      addTrackTextSearchConf(
        trackId: string,
        assemblies: string[],
        attributes: string[],
        exclude: string[],
      ) {
        const currentTrackIdx = (self.session?.tracks as Track[]).findIndex(
          t => trackId === t.trackId,
        )
        // name of index
        const id = trackId + '-index'
        const adapterConf = createTextSearchConf(
          id,
          [trackId],
          assemblies,
          this.formatLocation(),
        )
        self.session?.tracks[currentTrackIdx].textSearching.setSubschema(
          'textSearchAdapter',
          adapterConf,
        )
        self.session?.tracks[
          currentTrackIdx
        ].textSearching.indexingAttributes.set(attributes)
        self.session?.tracks[
          currentTrackIdx
        ].textSearching.indexingFeatureTypesToExclude.set(exclude)
      },
      addAggregateTextSearchConf(trackIds: string[], asm: string) {
        // name of index
        const id = asm + '-index'
        const foundIdx = self.aggregateTextSearchAdapters.findIndex(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (x: any) => x.textSearchAdapterId === id,
        )
        const trixConf = createTextSearchConf(
          id,
          trackIds,
          [asm],
          this.formatLocation(),
        )
        if (foundIdx === -1) {
          self.aggregateTextSearchAdapters.push(trixConf)
        } else {
          self.aggregateTextSearchAdapters[foundIdx] = trixConf
        }
      },
      formatLocation() {
        const locationPath = self.sessionPath.substring(
          0,
          self.sessionPath.lastIndexOf('/'),
        )
        return locationPath
      },
      afterCreate() {
        addDisposer(
          self,
          autorun(
            async () => {
              if (self.jobsQueue?.length > 0 && self.running === false) {
                await this.runJob()
              }
            },
            { delay: 1000 },
          ),
        )
      },
    }))
}

export type JobsStateModel = Instance<ReturnType<typeof jobsModelFactory>>
