import assert from 'node:assert/strict'
import fs from 'node:fs'
import dotenv from 'dotenv'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { randomUUID, createHash } from 'node:crypto'
import handler, { NFT_BUCKET } from '../api/nft-upload.js'

const env = dotenv.parse(fs.readFileSync('.env'))
for (const [key, value] of Object.entries(env)) if (!process.env[key]) process.env[key] = value
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const client = createClient(url, serviceKey)
const cleanup = new Set()
const testIp = `nft-storage-test-${randomUUID()}`
const quotaSubject = createHash('sha256').update(randomUUID()).digest('hex')

async function request(body, origin = 'https://www.basehub.fun') {
  const res = { statusCode: 200, setHeader() {}, status(value) { this.statusCode = value; return this }, json(value) { this.body = value; return this } }
  await handler({ method: 'POST', headers: { origin, 'x-forwarded-for': testIp }, body }, res)
  return res
}

try {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: Math.floor(Math.random() * 255), g: 83, b: 42 } } }).png().toBuffer()
  const image = await request({ type: 'file', imageBase64: png.toString('base64'), mimeType: 'image/jpeg' })
  assert.equal(image.statusCode, 200)
  cleanup.add(image.body.path)
  const publicImage = await fetch(image.body.url)
  assert.equal(publicImage.status, 200)
  assert.match(publicImage.headers.get('content-type'), /image\/png/)
  assert.deepEqual(Buffer.from(await publicImage.arrayBuffer()), png)
  const duplicate = await request({ type: 'file', imageBase64: png.toString('base64') })
  assert.equal(duplicate.statusCode, 200)
  assert.equal(duplicate.body.url, image.body.url)
  const metadata = { name: `Storage test ${Date.now()}`, image: image.body.url, attributes: [] }
  const json = await request({ type: 'metadata', metadata })
  assert.equal(json.statusCode, 200)
  cleanup.add(json.body.path)
  const publicMetadata = await fetch(json.body.url)
  assert.equal(publicMetadata.status, 200)
  assert.deepEqual(await publicMetadata.json(), metadata)
  assert.equal((await request({ type: 'file', imageBase64: Buffer.from('<svg/>').toString('base64') })).statusCode, 400)
  assert.equal((await request({ type: 'file', imageBase64: 'a'.repeat(5 * 1024 * 1024) })).statusCode, 413)
  assert.equal((await request({ type: 'metadata', metadata: { name: 'Bad', image: 'javascript:alert(1)' } })).statusCode, 400)
  assert.equal((await request({ type: 'metadata', metadata: { ...metadata, description: 'x'.repeat(70000) } })).statusCode, 413)
  assert.equal((await request({ type: 'metadata', metadata }, 'https://example.org')).statusCode, 403)
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  assert.ok(anonKey, 'Anonymous key needed to verify write restrictions')
  const anonymous = createClient(url, anonKey)
  const denied = await anonymous.storage.from(NFT_BUCKET).upload(`tests/denied-${Date.now()}.png`, png, { contentType: 'image/png' })
  if (!denied.error) cleanup.add(denied.data.path)
  assert.ok(denied.error, 'Anonymous uploads must be blocked')
  const overwritten = await anonymous.storage.from(NFT_BUCKET).upload(image.body.path, Buffer.from('changed'), { upsert: true, contentType: 'image/png' })
  assert.ok(overwritten.error, 'Anonymous overwrite must be blocked')
  await anonymous.storage.from(NFT_BUCKET).remove([image.body.path])
  const preservedImage = await fetch(image.body.url, { headers: { 'Cache-Control': 'no-cache' } })
  assert.equal(preservedImage.status, 200)
  assert.deepEqual(Buffer.from(await preservedImage.arrayBuffer()), png)
  const unauthorizedQuota = await anonymous.rpc('consume_nft_upload_quota', { p_subject: quotaSubject })
  assert.ok(unauthorizedQuota.error, 'Quota RPC must be server-only')
  const concurrent = await Promise.all(Array.from({ length: 21 }, () => client.rpc('consume_nft_upload_quota', { p_subject: quotaSubject })))
  for (const result of concurrent) assert.equal(result.error, null)
  assert.equal(concurrent.filter(result => result.data === true).length, 20)
  assert.equal(concurrent.filter(result => result.data === false).length, 1)
  let throttled
  for (let i = 0; i < 21; i++) throttled = await request({ type: 'invalid' })
  assert.equal(throttled.statusCode, 429)
  console.log('PASS: live image and metadata, public reads, duplicate upload, MIME detection, validation, anonymous write restriction')
} finally {
  if (cleanup.size) {
    const { error } = await client.storage.from(NFT_BUCKET).remove([...cleanup])
    if (error) throw new Error(`Test cleanup failed: ${error.message}`)
  }
  await client.from('nft_upload_quota').delete().in('subject', [`${quotaSubject}:minute`, `${quotaSubject}:day`])
}
