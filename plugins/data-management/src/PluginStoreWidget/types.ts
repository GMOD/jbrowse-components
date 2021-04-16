export interface JBrowsePlugin {
  name: string
  authors: string[]
  description: string
  location: string
  url: string
  license: string
  image?: string
}

export interface BasePlugin {
  version?: string
  name: string
  url?: string
}

export interface TextUpdateEvent {
  target: {
    value: string
  }
}
