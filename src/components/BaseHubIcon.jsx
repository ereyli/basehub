import React from 'react'

const Glyph = ({ children, size = 24, title, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    role={title ? 'img' : 'presentation'}
    aria-hidden={title ? undefined : true}
    {...props}
  >
    {title && <title>{title}</title>}
    {children}
  </svg>
)

const GLYPHS = {
  home: <><path d="M4.5 10.2 12 4l7.5 6.2v8.3a1.5 1.5 0 0 1-1.5 1.5h-4v-5.2h-4V20H6a1.5 1.5 0 0 1-1.5-1.5Z"/><path d="M8 11.2h8"/></>,
  swap: <><path d="M5 7.5h12.5"/><path d="m14.5 4.5 3 3-3 3"/><path d="M19 16.5H6.5"/><path d="m9.5 19.5-3-3 3-3"/><circle cx="5" cy="7.5" r="1.5"/><circle cx="19" cy="16.5" r="1.5"/></>,
  'early-access': <><path d="M12 3.5 15 8l5.2 1.4-3.3 4.1.3 5.3L12 17l-5.2 1.8.3-5.3-3.3-4.1L9 8Z"/><path d="m9.2 12 1.8 1.8 4-4"/></>,
  'nft-wheel': <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 4v6m0 4v6M4 12h6m4 0h6M6.3 6.3l4.2 4.2m3 3 4.2 4.2M17.7 6.3l-4.2 4.2m-3 3-4.2 4.2"/></>,
  'nft-plinko': <><path d="m5 4 7 16 7-16"/><circle cx="12" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="14" r="1" fill="currentColor" stroke="none"/><path d="M7.8 16.4h8.4"/></>,
  flip: <><circle cx="12" cy="12" r="7.5"/><path d="M4.5 12h15"/><path d="m8 8-2-2 2-2M16 16l2 2-2 2"/><path d="M6 6a8.5 8.5 0 0 1 12 0M18 18a8.5 8.5 0 0 1-12 0"/></>,
  dice: <><path d="M5 7.5 12 4l7 3.5v9L12 20l-7-3.5Z"/><path d="M5 7.5 12 11l7-3.5M12 11v9"/><circle cx="9" cy="8" r=".8" fill="currentColor" stroke="none"/><circle cx="8" cy="14" r=".8" fill="currentColor" stroke="none"/><circle cx="16" cy="13" r=".8" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r=".8" fill="currentColor" stroke="none"/></>,
  slot: <><rect x="4" y="5" width="16" height="14" rx="3"/><path d="M7 9h10v6H7z"/><path d="M10.3 9v6m3.4-6v6M7 17h6"/><path d="M20 9h1.5v5H20"/></>,
  lucky: <><circle cx="12" cy="12" r="8"/><path d="m12 6.5 1.3 4.2 4.2 1.3-4.2 1.3-1.3 4.2-1.3-4.2L6.5 12l4.2-1.3Z"/><path d="M12 4V3m8 9h1M12 20v1M4 12H3"/></>,
  'wallet-analysis': <><path d="M4 7.5h13.5a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M4.5 8 15 4.5v3M14 13.5h5.5"/><circle cx="15.5" cy="13.5" r=".8" fill="currentColor" stroke="none"/><path d="m7 16 2-2 1.6 1.4 2.2-3"/></>,
  'contract-security': <><path d="M12 3.5 19 6v5.3c0 4.3-2.8 7.3-7 9.2-4.2-1.9-7-4.9-7-9.2V6Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/><path d="M12 3.5V6"/></>,
  'allowance-cleaner': <><path d="M7 7h10l-.7 12H7.7Z"/><path d="M9 7V4.8h6V7M5.5 7h13M10 10v6m4-6v6"/><path d="m17.5 4.5 2-2"/></>,
  'base-guild-companion': <><path d="m12 3 7 3v5.5c0 4-2.7 6.9-7 9-4.3-2.1-7-5-7-9V6Z"/><path d="M8.5 10.5 12 7l3.5 3.5L12 14Z"/><path d="M9 16h6"/></>,
  'agent-mode': <><rect x="5" y="7" width="14" height="11" rx="3"/><path d="M12 4v3M9 12h.01M15 12h.01M9 15h6"/><path d="M3 11v3m18-3v3"/></>,
  'deploy-erc8004': <><path d="M12 3.5 19 7v10l-7 3.5L5 17V7Z"/><path d="m8.5 12 2 2 5-5M12 3.5V7"/></>,
  'agent-directory': <><circle cx="8" cy="9" r="3"/><circle cx="16.5" cy="10" r="2.5"/><path d="M3.5 19c.5-3.2 2-5 4.5-5s4 1.8 4.5 5M13 18.5c.3-2.4 1.5-3.8 3.5-3.8 2.1 0 3.3 1.4 3.7 3.8"/></>,
  'deploy-b20': <><path d="M7 4h6a3.2 3.2 0 0 1 0 6.4H7Z"/><path d="M7 10.4h7a3.8 3.8 0 0 1 0 7.6H7Z"/><path d="M10 4V2m3 2V2m-3 16v2m3-2v2"/><path d="M17.5 6.5h2v11"/></>,
  deploy: <><rect x="4.5" y="10" width="15" height="9.5" rx="2"/><path d="M12 15V3.5m0 0L8.5 7M12 3.5 15.5 7"/><path d="M8 15.5h8"/></>,
  'deploy-erc721': <><rect x="4.5" y="4" width="12" height="14" rx="2"/><path d="m7 14 2.8-3 2.2 2 1.5-1.5 3 3.3"/><circle cx="12.5" cy="8" r="1.2"/><path d="M8 20h9.5a2 2 0 0 0 2-2V8"/></>,
  'deploy-erc1155': <><path d="m12 3 7 3.7v7.6L12 18l-7-3.7V6.7Z"/><path d="m5 6.7 7 3.7 7-3.7M12 10.4V18"/><path d="m8 19 4 2 4-2"/></>,
  'nft-launchpad': <><rect x="4" y="5" width="12" height="14" rx="2"/><path d="m6.5 16 3-3.5 2.3 2 1.7-1.8L16 15"/><circle cx="12.5" cy="9" r="1.2"/><path d="M18 5v6m-3-3h6"/></>,
  'nft-launchpad-explore': <><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><path d="M16.5 13v7M13 16.5h7"/></>,
  pumphub: <><path d="M4 18.5h16"/><path d="m6 15 4-4 3 2 5-6"/><path d="M14 7h4v4"/><circle cx="6" cy="15" r="1.3"/><circle cx="10" cy="11" r="1.3"/><circle cx="13" cy="13" r="1.3"/></>,
  gaming: <><path d="M7.5 8h9a4 4 0 0 1 3.8 5.2l-1.1 3.3a2.3 2.3 0 0 1-3.8.9L13.8 16h-3.6l-1.6 1.4a2.3 2.3 0 0 1-3.8-.9l-1.1-3.3A4 4 0 0 1 7.5 8Z"/><path d="M8 11v4m-2-2h4M15.5 12h.01M17.5 14h.01"/></>,
  analysis: <><rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="m7 15 3-3 2.5 2 4.5-5"/><path d="M14 9h3v3"/></>,
  nft: <><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m7 16 3.4-4 2.6 2.4 2-2.2 2 2.3"/><circle cx="15.5" cy="8.5" r="1.3"/></>,
  rocket: <><path d="M9 15c3.8.4 7.5-3.3 9-10-6.7 1.5-10.4 5.2-10 9Z"/><circle cx="14" cy="9" r="1.5"/><path d="M9 10.5 5.5 12 4 16l4-1M12.5 15l-1 4 4-1.5 1.2-3.7M9 15l-2.5 2.5"/></>,
  gmgn: <><path d="M4.5 6.5h7v6h-4L5 15v-2.5h-.5Z"/><path d="M12.5 9h7v6h-.5v2.5L16.5 15h-4Z"/><path d="M7 9h2m6 3h2"/></>,
  profile: <><path d="M12 3.5 19 7v10l-7 3.5L5 17V7Z"/><circle cx="12" cy="10" r="2.5"/><path d="M8.2 17c.5-2.6 1.7-4 3.8-4s3.3 1.4 3.8 4"/></>,
  quests: <><path d="M6 20V5"/><path d="M6 6h10l-2 3 2 3H6"/><circle cx="17.5" cy="17.5" r="3"/><path d="m16.2 17.5.9.9 1.8-2"/></>,
  xp: <><path d="m13 2-7 11h5l-1 9 8-12h-5Z"/></>,
  level: <><path d="m5 15 7-7 7 7"/><path d="m7 19 5-5 5 5"/></>,
}

const ICON_ALIASES = {
  Home: 'home', Repeat: 'swap', ArrowLeftRight: 'swap', Rocket: 'rocket', Sparkles: 'early-access',
  CircleDot: 'nft-plinko', Coins: 'flip', Dice1: 'dice', Gift: 'slot', RotateCcw: 'lucky',
  Search: 'wallet-analysis', Shield: 'contract-security', Trash2: 'allowance-cleaner', Bot: 'agent-mode',
  Users: 'agent-directory', Package: 'deploy-erc721', Factory: 'deploy-erc1155', Image: 'nft',
  LayoutGrid: 'nft-launchpad-explore', Zap: 'pumphub', TrendingUp: 'analysis', Gamepad2: 'gaming',
}

export const BaseHubGlyph = ({ name, productId, ...props }) => {
  const key = productId || ICON_ALIASES[name] || name
  return <Glyph {...props}>{GLYPHS[key] || GLYPHS.rocket}</Glyph>
}

export default BaseHubGlyph
