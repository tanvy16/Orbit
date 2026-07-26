import http from 'node:http'

import type { DesktopActionPlan, DesktopActionResult } from '@shared/types'

import { executeDesktopAction } from './desktop-actions'

const DEFAULT_PORT = 18766
const HOST = '127.0.0.1'

function readJson<T>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? (JSON.parse(raw) as T) : ({} as T))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

export function startDesktopBridgeServer(): http.Server {
  const port = Number(process.env['ORBIT_DESKTOP_BRIDGE_PORT'] ?? DEFAULT_PORT)
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, { ok: true, service: 'orbit-desktop-bridge' })
      return
    }

    if (req.method === 'POST' && req.url === '/execute') {
      try {
        const plan = (await readJson<DesktopActionPlan>(req)) as DesktopActionPlan
        if (!plan?.type) {
          sendJson(res, 400, { ok: false, message: 'Invalid action plan' })
          return
        }
        const result: DesktopActionResult = await executeDesktopAction(plan)
        sendJson(res, result.ok ? 200 : 500, result)
      } catch (error) {
        sendJson(res, 500, {
          ok: false,
          message: error instanceof Error ? error.message : 'Desktop execution failed',
        })
      }
      return
    }

    sendJson(res, 404, { ok: false, message: 'Not found' })
  })

  server.listen(port, HOST, () => {
    console.info(`[orbit] Desktop bridge listening on http://${HOST}:${port}`)
  })

  return server
}
