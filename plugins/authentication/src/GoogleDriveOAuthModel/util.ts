import { descriptiveErrorMessage } from '../util.ts'

interface GoogleDriveError {
  error: {
    errors: {
      domain: string
      reason: string
      message: string
      locationType?: string
      location?: string
    }[]
    code: number
    message: string
  }
}

export const getDescriptiveErrorMessage =
  descriptiveErrorMessage<GoogleDriveError>(err => err.error.message)
