import { Navigate } from 'react-router-dom'

/** GM is sent from header / home / Base Guild page — avoid a separate “GM Game” route. */
const GMGame = () => <Navigate to="/base-guild" replace />

export default GMGame
