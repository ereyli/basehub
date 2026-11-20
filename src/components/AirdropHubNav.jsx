import { LayoutGrid, Search } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { AIRDROP_HUB_PATH, AIRDROP_SIMULATOR_PATH } from '../config/products'
import './AirdropHubNav.css'

export default function AirdropHubNav() {
  return (
    <nav className="airdrop-hub-nav" aria-label="Airdrop Hub sections">
      <NavLink to={AIRDROP_HUB_PATH} end>
        <LayoutGrid size={16} aria-hidden="true" /> Network tasks
      </NavLink>
      <NavLink to={AIRDROP_SIMULATOR_PATH} end>
        <Search size={16} aria-hidden="true" /> Base Airdrop Simulator
      </NavLink>
    </nav>
  )
}
