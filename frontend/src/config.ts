// Centralized configuration for the Orange City Mart frontend

// Use Vite environment variables if available, otherwise fall back to local tunnel backend
const TUNNEL_URL = 'https://difference-glance-clear-matthew.trycloudflare.com';
export const API_URL = import.meta.env.VITE_API_URL || `${TUNNEL_URL}/api`;
export const WS_URL = import.meta.env.VITE_WS_URL || `${TUNNEL_URL.replace('https', 'wss')}/ws`;
export const BASE_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : TUNNEL_URL;



