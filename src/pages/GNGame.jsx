import { Navigate } from 'react-router-dom'

/** GN is sent from header / home / Base Guild page — avoid a separate “GN Game” route. */
const GNGame = () => <Navigate to="/base-guild" replace />

export default GNGame
