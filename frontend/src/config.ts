// Centralized configuration for the Orange City Mart frontend
//
// Uses relative URLs so the Vite proxy (and any reverse-proxy in prod)
// forwards /api → backend and /ws → backend WS.
// Override with env vars for staging / production deploys.

export const API_URL = import.meta.env.VITE_API_URL || '/api'

// WebSocket URL must be absolute. Derive from window.location at runtime
// so it works behind any proxy (http→ws, https→wss).
function buildWsUrl(): string {
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    return `${protocol}://${window.location.host}/ws`
}

export const WS_URL = buildWsUrl()
