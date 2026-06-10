import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { SESClient } from '@aws-sdk/client-ses'

const raw = new DynamoDBClient({})
export const dynamo = DynamoDBDocumentClient.from(raw)
export const ses = new SESClient({})

export const TABLE = process.env.TABLE_NAME!
export const FROM = process.env.FROM_EMAIL!
export const API_URL = process.env.API_URL!

export function jsonResponse(statusCode: number, body: object) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export function htmlResponse(statusCode: number, html: string) {
  return {
    statusCode,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html,
  }
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function responsePage(title: string, message: string, color: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title} - JBrowse</title>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: #fff; border-radius: 8px; padding: 2rem; max-width: 420px;
            text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,.12); }
    h1 { color: ${color}; margin-top: 0; }
    a { color: #2d7a57; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <p><a href="https://jbrowse.org/jb2/">← Back to JBrowse</a></p>
  </div>
</body>
</html>`
}
