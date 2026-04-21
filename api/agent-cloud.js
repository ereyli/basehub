import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { disableCloudSession, getCloudSession, upsertCloudSession } from './_agentCloud.js'

const app = new Hono()
app.use('/*', cors())

app.get('/', async (c) => {
  const ownerAddress = c.req.query('ownerAddress')
  const result = await getCloudSession(ownerAddress)
  return c.json(result)
})

app.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const eventType = String(body.eventType || '')

  if (eventType === 'disable') {
    const session = await disableCloudSession(body.ownerAddress)
    return c.json({ ok: true, session })
  }

  if (eventType !== 'register') {
    return c.json({ error: 'Unsupported Cloud Agent eventType.' }, 400)
  }

  const session = await upsertCloudSession({
    ownerAddress: body.ownerAddress,
    subAccountAddress: body.subAccountAddress,
    subAccount: body.subAccount,
    spendPermission: body.spendPermission,
    allowanceEth: body.allowanceEth,
    periodInDays: body.periodInDays,
    policy: body.policy,
  })

  return c.json({ ok: true, session })
})

export default async function handler(req, res) {
  try {
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
  } catch (error) {
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: error.message || 'Cloud Agent failed.' }))
  }
}
