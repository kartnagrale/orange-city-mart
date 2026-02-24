// Centralized configuration for the Orange City Mart frontend

// Use Vite environment variables if available, otherwise default to local backend
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
export const BASE_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:8080';
