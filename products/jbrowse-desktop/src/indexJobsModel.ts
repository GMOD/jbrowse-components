import fs from 'fs'
import path from 'path'
import { isSessionModelWithWidgets } from '@jbrowse/core/util'
import {
  createTextSearchConf,
  findTrackConfigsToIndex,
} from '@jbrowse/text-indexing'
import { autorun, observable, toJS } from 'mobx'
import { addDisposer, getParent, types, getSnapshot } from 'mobx-state-tree'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from 'mobx-state-tree'

const { ipcRenderer } = window.require('electron')

const ONE_HOUR = 60 * 60 * 1000

type Track = Record<string, any>

interface TrackTextIndexing {
  attributes: string[]
  exclude: string[]
  assemblies: string[]
  tracks: string[] // trackIds
  indexType: string
  timestamp?: string
  name?: string
}

interface JobsEntry {
  name: string
  cancelCallback?: () => void
  progressPct?: number
  statusMessage?: string
}
export interface TextJobsEntry extends JobsEntry {
  indexingParams: TrackTextIndexing
}

export default function jobsModelFactory(_pluginManager: PluginManager) {
  return types
    .model('JobsManager', {})
    .volatile(() => ({
      /**
       * #volatile
       */
      running: false,
      /**
       * #volatile
       */
      statusMessage: '',
      /**
       * #volatile
       */
      progressPct: 0,
      /**
       * #volatile
       */
      jobName: '',
      /**
       * #volatile
       */
      jobsQueue: observable.array<TextJobsEntry>([]),
      /**
       * #volatile
       */
      finishedJobs: observable.array<TextJobsEntry>([]),
    }))
    .views(self => ({
      /**
       * #getter
       */
      get rpcManager() {
        return getParent<any>(self).jbrowse.rpcManager
      },
      /**
       * #getter
       */
      get tracks() {
        return getParent<any>(self).jbrowse.tracks
      },
      /**
       * #getter
       */
      get sessionPath() {
        return getParent<any>(self).sessionPath
      },
      /**
       * #getter
       */
      get session() {
        return getParent<any>(self).session
      },
      /**
       * #getter
       */
      get aggregateTextSearchAdapters() {
        return getParent<any>(self).jbrowse.aggregateTextSearchAdapters
      },
    }))
    .actions(self => ({
      /**
       * #method
       */
      getJobStatusWidget() {
        const { session } = self
        const { widgets } = session
        let jobStatusWidget = widgets.get('JobsList')
        if (!jobStatusWidget) {
          jobStatusWidget = session.addWidget('JobsListWidget', 'JobsList')
        }
        return jobStatusWidget
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setRunning(running: boolean) {
        self.running = running
      },
      /**
       * #action
       */
      setJobName(name: string) {
        self.jobName = name
      },
      /**
       * #action
       */
      setProgressPct(arg: string) {
        const progress = +arg
        if (Number.isNaN(progress)) {
          this.setStatusMessage(arg)
        } else {
          if (progress === 100) {
            this.setStatusMessage('Generating ixIxx files.')
          }
          self.progressPct = progress
        }
        this.setWidgetStatus()
      },
      /**
       * #action
       */
      setWidgetStatus() {
        const jobStatusWidget = self.getJobStatusWidget()
        jobStatusWidget.updateJobStatusMessage(self.jobName, self.statusMessage)
        jobStatusWidget.updateJobProgressPct(self.jobName, self.progressPct)
      },
      /**
       * #action
       */
      setStatusMessage(arg: string) {
        self.statusMessage = arg
      },

      /**
       * #action
       */
      addFinishedJob(entry: TextJobsEntry) {
        self.finishedJobs.push(entry)
      },
      /**
       * #action
       */
      queueJob(props: TextJobsEntry) {
        const { session } = self
        if (isSessionModelWithWidgets(session)) {
          const jobStatusWidget = self.getJobStatusWidget()
          session.showWidget(jobStatusWidget)
          const {
            name,
            statusMessage = '',
            progressPct = 0,
            cancelCallback,
          } = props
          jobStatusWidget.addQueuedJob({
            name,
            statusMessage,
            progressPct,
            cancelCallback,
          })
        }
        self.jobsQueue.push(props)
      },
      /**
       * #action
       */
      dequeueJob() {
        const { session } = self
        if (isSessionModelWithWidgets(session)) {
          const jobStatusWidget = self.getJobStatusWidget()
          jobStatusWidget.removeJob(self.jobName)
        }
        return self.jobsQueue.splice(0, 1)[0]
      },
      /**
       * #action
       */
      clear() {
        this.setRunning(false)
        this.setStatusMessage('')
        this.setJobName('')
        self.progressPct = 0
      },
      /**
       * #action
       */
      async runIndexingJob(entry: TextJobsEntry) {
        const { session } = self
        const {
          tracks: trackIds,
          exclude,
          attributes,
          assemblies,
          indexType,
        } = toJS(entry.indexingParams)
        const rpcManager = self.rpcManager
        const trackConfigs = findTrackConfigsToIndex(self.tracks, trackIds).map(
          // @ts-expect-error
          c => JSON.parse(JSON.stringify(getSnapshot(c))),
        )
        try {
          this.setRunning(true)
          this.setJobName(entry.name)
          const userData = await ipcRenderer.invoke('userData')
          const outLocation = path.join(
            userData,
            'nameIndices',
            `trix-${+Date.now()}`,
          )
          fs.mkdirSync(outLocation, { recursive: true })
          await rpcManager.call('indexTracksSessionId', 'TextIndexRpcMethod', {
            tracks: trackConfigs,
            attributes,
            exclude,
            assemblies,
            indexType,
            outLocation,
            sessionId: 'indexTracksSessionId',
            statusCallback: (message: string) => {
              this.setProgressPct(message)
            },
            timeout: 1000 * ONE_HOUR,
          })
          if (indexType === 'perTrack') {
            trackIds.forEach(trackId => {
              this.addTrackTextSearchConf({
                trackId,
                assemblies,
                attributes,
                exclude,
                outLocation,
              })
              self.session?.notify(
                `Successfully indexed track with trackId: ${trackId} `,
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
              this.addAggregateTextSearchConf({
                trackIds: indexedTrackIds,
                assemblyName,
                outLocation,
              })
              self.session?.notify(
                `Successfully indexed assembly: ${assemblyName} `,
                'success',
              )
            })
          }
          // remove from the queue and add to finished/completed jobs
          const current = this.dequeueJob()
          if (current) {
            this.addFinishedJob(current)
            if (isSessionModelWithWidgets(session)) {
              const jobStatusWidget = self.getJobStatusWidget()
              session.showWidget(jobStatusWidget)
              const { name, statusMessage, progressPct, cancelCallback } =
                current
              jobStatusWidget.addFinishedJob({
                name,
                statusMessage: statusMessage || 'done',
                progressPct: progressPct || 100,
                cancelCallback,
              })
            }
          }
        } catch (e) {
          console.error(e)

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
          // remove job from queue but since it was not successful
          // do not add to finished list
          this.dequeueJob()
        }
        // clear
        this.clear()
      },
      async runJob() {
        const { session } = self
        if (self.jobsQueue.length) {
          const firstIndexingJob = self.jobsQueue[0]!
          if (isSessionModelWithWidgets(session)) {
            const jobStatusWidget = self.getJobStatusWidget()
            session.showWidget(jobStatusWidget)
            const { name, statusMessage, progressPct, cancelCallback } =
              firstIndexingJob
            jobStatusWidget.addJob({
              name,
              statusMessage: statusMessage || '',
              progressPct: progressPct || 0,
              cancelCallback,
            })
            jobStatusWidget.removeQueuedJob(name)
          }
          await this.runIndexingJob(firstIndexingJob)
        }
      },
      /**
       * #action
       */
      addTrackTextSearchConf({
        trackId,
        assemblies,
        attributes,
        exclude,
        outLocation,
      }: {
        trackId: string
        assemblies: string[]
        attributes: string[]
        exclude: string[]
        outLocation: string
      }) {
        const currentTrackIdx = self.session.tracks.findIndex(
          (t: Track) => trackId === t.trackId,
        )
        // name of index
        const id = `${trackId}-index`
        const adapterConf = createTextSearchConf(
          id,
          [trackId],
          assemblies,
          outLocation,
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
      addAggregateTextSearchConf({
        trackIds,
        assemblyName,
        outLocation,
      }: {
        trackIds: string[]
        assemblyName: string
        outLocation: string
      }) {
        // name of index
        const id = `${assemblyName}-index`
        const foundIdx = self.aggregateTextSearchAdapters.findIndex(
          (x: any) => x.textSearchAdapterId === id,
        )
        const trixConf = createTextSearchConf(
          id,
          trackIds,
          [assemblyName],
          outLocation,
        )
        if (foundIdx === -1) {
          self.aggregateTextSearchAdapters.push(trixConf)
        } else {
          self.aggregateTextSearchAdapters[foundIdx] = trixConf
        }
      },
      afterCreate() {
        addDisposer(
          self,
          autorun(
            async () => {
              if (self.jobsQueue.length > 0 && !self.running) {
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
