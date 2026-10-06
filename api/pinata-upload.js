// Cached clients must reload rather than minting with a fabricated IPFS CID.
export default function handler(req, res) {
  return res.status(410).json({ error: 'Upload service has changed. Please reload the app and try again.' })
}
