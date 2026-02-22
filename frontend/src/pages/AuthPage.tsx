import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ShoppingBag, Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

type Tab = 'login' | 'register'

export default function AuthPage() {
    const [tab, setTab] = useState<Tab>('login')
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPw, setShowPw] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const { login, register } = useAuth()
    const navigate = useNavigate()

    const switchTab = (t: Tab) => {
        setTab(t)
        setError('')
        setName('')
        setEmail('')
        setPassword('')
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            if (tab === 'login') {
                await login(email, password)
            } else {
                await register(name, email, password)
            }
            navigate('/dashboard')
        } catch (err: any) {
            setError(err.message || 'Something went wrong')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex flex-col items-center justify-center px-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 mb-10 group">
                <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-200 group-hover:scale-105 transition-transform">
                    <ShoppingBag size={20} className="text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">
                    Orange City <span className="text-orange-500">Mart</span>
                </span>
            </Link>

            {/* Card */}
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-gray-100 border border-gray-100 overflow-hidden">
                {/* Tab switcher */}
                <div className="flex border-b border-gray-100">
                    {(['login', 'register'] as Tab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => switchTab(t)}
                            className={`flex-1 py-4 text-sm font-semibold transition-all duration-200 ${tab === t
                                ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50/50'
                                : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            {t === 'login' ? 'Sign In' : 'Create Account'}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-5">
                    <div className="mb-1">
                        <h2 className="text-xl font-bold text-gray-900">
                            {tab === 'login' ? 'Welcome back!' : 'Join Orange City Mart'}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {tab === 'login'
                                ? "Sign in to your account to continue"
                                : "Create your free account today"}
                        </p>
                    </div>

                    {/* Name (register only) */}
                    {tab === 'register' && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Full Name</label>
                            <div className="relative">
                                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    id="auth-name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ravi Kumar"
                                    required
                                    className="input pl-10 w-full"
                                />
                            </div>
                        </div>
                    )}

                    {/* Email */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Email Address</label>
                        <div className="relative">
                            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                id="auth-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                className="input pl-10 w-full"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Password</label>
                        <div className="relative">
                            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                id="auth-password"
                                type={showPw ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={tab === 'register' ? 'At least 8 characters' : '••••••••'}
                                required
                                minLength={tab === 'register' ? 8 : 1}
                                className="input pl-10 pr-10 w-full"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPw(!showPw)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <>
                                {tab === 'login' ? 'Sign In' : 'Create Account'}
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>

                    {/* Switch hint */}
                    <p className="text-center text-sm text-gray-500">
                        {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
                        <button
                            type="button"
                            onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
                            className="text-orange-600 hover:text-orange-700 font-semibold"
                        >
                            {tab === 'login' ? 'Sign up' : 'Sign in'}
                        </button>
                    </p>
                </form>
            </div>

            <p className="mt-8 text-xs text-gray-400">
                © {new Date().getFullYear()} Orange City Mart. Nagpur's trusted marketplace.
            </p>
        </div>
    )
}
