import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  getAgentMemorySnapshot,
  insertAgentMemory,
  insertAgentReflection,
  insertAgentRun,
  upsertAgentProfile,
} from './_agentMemory.js'

const app = new Hono()
app.use('/*', cors())

app.get('/', async (c) => {
  const walletAddress = c.req.query('walletAddress')
  const snapshot = await getAgentMemorySnapshot(walletAddress)
  return c.json(snapshot)
})

app.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const walletAddress = String(body.walletAddress || '')
  const eventType = String(body.eventType || '')

  if (!walletAddress || !eventType) {
    return c.json({ error: 'walletAddress and eventType are required.' }, 400)
  }

  if (eventType === 'profile') {
    await upsertAgentProfile({
      walletAddress,
      objective: body.objective || '',
      currentIntent: body.currentIntent || '',
      plannerMode: body.plannerMode || '',
    })
  } else if (eventType === 'memory') {
    await insertAgentMemory({
      walletAddress,
      memoryType: body.memoryType || 'note',
      title: body.title || 'Agent memory',
      body: body.body || '',
      meta: body.meta || {},
    })
  } else if (eventType === 'run') {
    await insertAgentRun({
      walletAddress,
      status: body.status || 'info',
      summary: body.summary || '',
      plannedActions: Number(body.plannedActions || 0),
      executedAction: body.executedAction || null,
    })
  } else if (eventType === 'reflection') {
    await insertAgentReflection({
      walletAddress,
      reflectionType: body.reflectionType || 'critic',
      body: body.body || '',
      score: typeof body.score === 'number' ? body.score : null,
      meta: body.meta || {},
    })
  }

  return c.json({ ok: true })
})

export default async function handler(req, res) {
  const urlParts = (req.url || '/').split('?')
  const queryString = urlParts[1] || ''
  const protocol = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers.host || req.headers['x-forwarded-host'] || 'localhost'
  const fullUrl = `${protocol}://${host}/${queryString ? `?${queryString}` : ''}`
  const body =
    req.method !== 'GET' && req.method !== 'HEAD' && req.body
      ? typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body)
      : undefined

  const request = new Request(fullUrl, {
    method: req.method || 'GET',
    headers: new Headers(req.headers || {}),
    body,
  })

  const response = await app.fetch(request)
  response.headers.forEach((value, key) => res.setHeader(key, value))
  res.statusCode = response.status
  res.end(await response.text())
}
