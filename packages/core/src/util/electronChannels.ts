// The Electron main-process channels that core and plugins invoke. The app's
// own channel list extends this, so its handlers register against these
// entries and a renamed channel or changed result fails to compile at both
// ends. Import-free and DOM-free: the main process's typecheck reads it too.

export interface AuthWindowParams {
  internetAccountId: string
  data: { redirect_uri: string }
  url: string
}

export interface ElectronMainChannels {
  promptOpenLocalFile: {
    args: [defaultDir?: string]
    return: string | undefined
  }
  openAuthWindow: {
    args: [params: AuthWindowParams]
    return: string | undefined
  }
  // opens the BLAT server in a window so the user can solve its CAPTCHA
  openBlatChallenge: { args: [url: string]; return: boolean }
  // POSTs a BLAT query from the main process so the solved-challenge cookie
  // (held in the BLAT partition) attaches first-party; returns the raw body
  blatFetch: {
    args: [url: string, body: string]
    return: { ok: boolean; status: number; text: string }
  }
}
