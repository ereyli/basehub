import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import vm from 'node:vm'

let mode = 'normal'
let dimensions
let requests = []
let status = 200
let response = null
let revoked = 0
const context = vm.createContext({
  console, Blob, Uint8Array, atob, AbortController, setTimeout, clearTimeout,
  URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => { revoked++ } },
  window: { location: { hostname: 'www.basehub.fun', origin: 'https://www.basehub.fun' } },
  Image: class {
    width = 6000
    height = 3000
    set src(value) { queueMicrotask(() => mode === 'invalid' ? this.onerror() : this.onload()) }
  },
  document: { createElement() {
    return {
      getContext() {
        if (mode === 'no-canvas') return null
        return { drawImage: (...args) => { dimensions = args.slice(3) } }
      },
      toDataURL(format) {
        if (mode === 'canvas-error') throw new Error('Canvas failed')
        if (mode === 'too-large' || (mode === 'compress' && format === 'image/png')) return 'x'.repeat(3 * 1024 * 1024)
        return `data:${format};base64,aGVsbG8=`
      },
    }
  } },
  fetch: async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) })
    return { ok: status === 200, json: async () => response || { url: 'https://test.supabase.co/storage/v1/object/public/nft-assets/test.png' } }
  },
})
const modules = new Map()
async function load(file) {
  if (modules.has(file)) return modules.get(file)
  const module = new vm.SourceTextModule(await fs.readFile(file, 'utf8'), {
    context, identifier: file, initializeImportMeta: meta => { meta.env = {} },
  })
  modules.set(file, module)
  await module.link(specifier => load(path.resolve(path.dirname(file), `${specifier}.js`)))
  return module
}
const storage = await load(path.resolve('src/utils/nftStorage.js'))
await storage.evaluate()
const compression = modules.get(path.resolve('src/utils/imageUpload.js')).namespace
const proxy = modules.get(path.resolve('src/utils/nftUpload.js')).namespace
const blob = new Blob(['test'], { type: 'image/png' })
assert.match(await compression.compressImageForUpload(blob), /^data:image\/png/)
assert.deepEqual(dimensions, [1024, 512])
mode = 'compress'
assert.match(await compression.compressImageForUpload(blob), /^data:image\/webp/)
for (const [scenario, message] of [['invalid', /load failed/], ['no-canvas', /unavailable/], ['too-large', /too large/], ['canvas-error', /Canvas failed/]]) {
  mode = scenario
  await assert.rejects(compression.compressImageForUpload(blob), message)
}
assert.equal(revoked, 6)
mode = 'normal'
requests = []
await storage.namespace.uploadCollectionMetadata({ name: 'Collection', sellerFeeBasisPoints: 0 }, 'data:image/png;base64,aGVsbG8=')
assert.equal(requests.length, 2)
assert.equal(requests[0].url, 'https://www.basehub.fun/api/nft-upload')
assert.match(requests[0].body.imageBase64, /^data:image\/png/)
assert.equal(requests[1].body.metadata.seller_fee_basis_points, 0)
assert.match(requests[1].body.metadata.image, /^https:\/\//)
assert.equal(storage.namespace.getIPFSGatewayUrl('https://test.supabase.co/image.png'), 'https://test.supabase.co/image.png')
assert.equal(storage.namespace.getIPFSGatewayUrl('ipfs://QmExample'), 'https://nftstorage.link/ipfs/QmExample')
status = 429
response = { error: 'Upload limit reached' }
await assert.rejects(proxy.uploadMetadataViaProxy({}), /Upload limit reached/)
status = 200
response = { url: 'ipfs://unexpected' }
await assert.rejects(proxy.uploadMetadataViaProxy({}), /Invalid storage response/)
const hookSource = await fs.readFile('src/hooks/useAINFTMinting.js', 'utf8')
const start = hookSource.indexOf('const generateImage = async')
assert.ok(start >= 0)
const end = hookSource.indexOf('\n  };', start) + '\n  };'.length
let metadataURI = 'https://old.example/metadata.json'
let generatedImage = 'old-image'
context.setMetadataURI = value => { metadataURI = value }
context.setGeneratedImage = value => { generatedImage = value }
context.setIsGenerating = () => {}
context.setError = () => {}
const generator = new vm.SyntheticModule(['generateAIImage'], function () {
  this.setExport('generateAIImage', async () => {
    assert.equal(metadataURI, null, 'Previous metadata must be cleared before generation')
    return 'new-image'
  })
}, { context })
await generator.link(() => {})
await generator.evaluate()
const hookTest = new vm.SourceTextModule(`${hookSource.slice(start, end)}\nexport { generateImage };`, {
  context, importModuleDynamically: async () => generator,
})
await hookTest.link(() => {})
await hookTest.evaluate()
await hookTest.namespace.generateImage('new prompt')
assert.equal(generatedImage, 'new-image')
assert.equal(metadataURI, null)
console.log('PASS: client resizing, transparency, compression, invalid images, canvas errors, AI metadata, zero royalties, legacy URLs, upload errors')
console.log('PASS: new AI generation invalidates previous mint metadata')
