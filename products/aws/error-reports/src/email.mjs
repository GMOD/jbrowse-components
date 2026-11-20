const maxReportLength = 100_000
const maxNoteLength = 10_000
const maxSubjectLength = 100
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function clip(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function parseReport(body) {
  try {
    const fields = JSON.parse(body ?? '')
    const report = clip(fields.report, maxReportLength)
    const email = clip(fields.email, 320)
    return report
      ? {
          report,
          comment: clip(fields.comment, maxNoteLength),
          email: emailPattern.test(email) ? email : '',
        }
      : undefined
  } catch {
    return undefined
  }
}

function subjectLine(report) {
  const firstLine = report.split('\n').find(line => line.trim()) ?? ''
  return `JBrowse error report: ${firstLine.replaceAll(/\s+/g, ' ').trim().slice(0, maxSubjectLength)}`
}

function bodyText({ report, comment, email }) {
  return [
    `Reply to: ${email || 'no address given'}`,
    comment ? `What they were doing:\n${comment}` : '',
    report,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function buildEmail(fields, { from, to }) {
  return {
    FromEmailAddress: from,
    Destination: { ToAddresses: [to] },
    ReplyToAddresses: fields.email ? [fields.email] : undefined,
    Content: {
      Simple: {
        Subject: { Data: subjectLine(fields.report), Charset: 'UTF-8' },
        Body: { Text: { Data: bodyText(fields), Charset: 'UTF-8' } },
      },
    },
  }
}
