import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

interface User {
    id: string
    name: string
    email: string
    wallet_balance: number
}

interface AuthContextType {
    user: User | null
    token: string | null
    login: (email: string, password: string) => Promise<void>
    register: (name: string, email: string, password: string) => Promise<void>
    logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

import { API_URL as API } from '../config'

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(() => {
        try {
            const s = localStorage.getItem('ocm_user')
            return s ? JSON.parse(s) : null
        } catch {
            return null
        }
    })
    const [token, setToken] = useState<string | null>(
        () => localStorage.getItem('ocm_token')
    )

    useEffect(() => {
        if (user && token) {
            localStorage.setItem('ocm_user', JSON.stringify(user))
            localStorage.setItem('ocm_token', token)
        } else {
            localStorage.removeItem('ocm_user')
            localStorage.removeItem('ocm_token')
        }
    }, [user, token])

    const persist = (data: { token: string; user: User }) => {
        setToken(data.token)
        setUser(data.user)
    }

    // Fetch with 60 s timeout — Render free tier can take 50 s to cold-start
    const fetchWithTimeout = async (url: string, options: RequestInit) => {
        const controller = new AbortController()
        const timerId = setTimeout(() => controller.abort(), 60_000)
        try {
            return await fetch(url, { ...options, signal: controller.signal })
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') {
                throw new Error('Backend is waking up — please wait 30 s and try again.')
            }
            throw new Error('Cannot reach server. Check your connection and try again.')
        } finally {
            clearTimeout(timerId)
        }
    }

    const login = async (email: string, password: string) => {
        const res = await fetchWithTimeout(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        })
        if (!res.ok) {
            const msg = await res.text()
            throw new Error(msg.trim() || 'Login failed')
        }
        persist(await res.json())
    }

    const register = async (name: string, email: string, password: string) => {
        const res = await fetchWithTimeout(`${API}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
        })
        if (!res.ok) {
            const msg = await res.text()
            throw new Error(msg.trim() || 'Registration failed')
        }
        persist(await res.json())
    }

    const logout = () => {
        setUser(null)
        setToken(null)
    }

    return (
        <AuthContext.Provider value={{ user, token, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
    return ctx
}
