export const ERROR_REPORT_EMAIL = 'jbrowse2@berkeley.edu'

const errorReportUrl = 'https://api.jbrowse.org/errors/v1/report'

export async function sendErrorReport(fields: {
  report: string
  comment: string
  email: string
}) {
  const response = await fetch(errorReportUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(fields),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
}

export function withoutSharePassword(href: string) {
  const url = new URL(href)
  if (url.searchParams.has('password')) {
    url.searchParams.set('password', 'redacted')
  }
  return url.toString()
}
