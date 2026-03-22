import type { Episode } from '../RLPipeline/types.ts'

export default class JSONLExporter {
  export(episodes: Episode[]): string {
    const lines: string[] = []
    for (const episode of episodes) {
      for (const step of episode.steps) {
        lines.push(
          JSON.stringify({
            episode_id: episode.id,
            task_id: episode.taskId,
            timestamp: step.timestamp,
            observation: step.state,
            action: step.action,
            action_metadata: step.actionMetadata,
            reward: step.reward,
            next_observation: step.nextState,
            terminated: step.terminal,
            truncated: episode.outcome === 'timeout',
          }),
        )
      }
    }
    return lines.join('\n')
  }

  exportAsBlob(episodes: Episode[]): Blob {
    return new Blob([this.export(episodes)], {
      type: 'application/x-ndjson',
    })
  }

  downloadFilename(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    return `rl-analytics-${timestamp}.jsonl`
  }
}
