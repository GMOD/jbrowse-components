/**
 * manages groups of web workers and/or remote workers
 */
class WorkerManager {
  workerGroups = {}

  addWorkers(groups) {
    Object.entries(groups).forEach(([groupName, workers]) => {
      if (!this.workerGroups[groupName]) this.workerGroups[groupName] = []
      this.workerGroups[groupName].push(...workers)
    })
  }

  getWorkerGroup(name) {
    return this.workerGroups[name]
  }
}

export default WorkerManager
