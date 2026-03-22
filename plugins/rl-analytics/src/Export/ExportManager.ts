import type EpisodeManager from '../RLPipeline/EpisodeManager.ts'

import JSONLExporter from './JSONLExporter.ts'
import WebhookExporter from './WebhookExporter.ts'

export default class ExportManager {
  private jsonlExporter = new JSONLExporter()
  private webhookExporter: WebhookExporter | null = null
  private episodeManager: EpisodeManager

  constructor(episodeManager: EpisodeManager) {
    this.episodeManager = episodeManager
  }

  configureWebhook(url: string, batchSize?: number, intervalMs?: number) {
    if (this.webhookExporter) {
      this.webhookExporter.dispose()
    }
    if (url) {
      this.webhookExporter = new WebhookExporter(url, batchSize, intervalMs)
      this.webhookExporter.start()
    }
  }

  /** Download all episodes as JSONL file */
  downloadJSONL() {
    const episodes = this.episodeManager.getAllEpisodes()
    const blob = this.jsonlExporter.exportAsBlob(episodes)
    const filename = this.jsonlExporter.downloadFilename()

    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }

  /** Get JSONL string for all episodes */
  getJSONL(): string {
    return this.jsonlExporter.export(this.episodeManager.getAllEpisodes())
  }

  get webhook(): WebhookExporter | null {
    return this.webhookExporter
  }

  dispose() {
    this.webhookExporter?.dispose()
  }
}
