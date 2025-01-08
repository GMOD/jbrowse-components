export interface Display {
  id: string
  [key: string]: unknown
}

export interface Track {
  id: string
  displays: Display[]
  [key: string]: unknown
}
