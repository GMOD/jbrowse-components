// The JBrowse-hosted session-sharing backend. Single source of truth for both
// the write path (the root config's `shareURL` default, read via getConf) and
// the SessionLoader read path (which reads the raw config snapshot before config
// is initialized), so the two can't drift onto different endpoints.
export const DEFAULT_SHARE_URL = 'https://share.jbrowse.org/api/v1/'
