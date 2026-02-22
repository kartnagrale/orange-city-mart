import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ShoppingBag, Search, Wallet, MessageCircle, Gavel, Plus, Bell, LogOut, LogIn } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
    const location = useLocation()
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const isActive = (path: string) =>
        location.pathname === path ? 'text-orange-600' : 'text-gray-600 hover:text-orange-600'

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleLogout = () => {
        logout()
        setDropdownOpen(false)
        navigate('/')
    }

    // Initials avatar helper
    const initials = user?.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)

    return (
        <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                            <ShoppingBag size={18} className="text-white" />
                        </div>
                        <span className="font-bold text-gray-900 text-lg">
                            Orange City <span className="text-orange-500">Mart</span>
                        </span>
                    </Link>

                    {/* Search bar */}
                    <div className="hidden md:flex flex-1 max-w-xl mx-8">
                        <div className="relative w-full">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search products, auctions..."
                                className="input pl-10 pr-4 py-2.5 text-sm"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const q = (e.target as HTMLInputElement).value
                                        window.location.href = `/search?q=${encodeURIComponent(q)}`
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {/* Nav links */}
                    <div className="flex items-center gap-1">
                        <Link to="/dashboard" className={`btn-ghost text-sm font-medium ${isActive('/dashboard')}`}>
                            <span className="hidden sm:flex items-center gap-1.5">
                                <Gavel size={16} /> Auctions
                            </span>
                        </Link>
                        <Link to="/my-bids" className={`btn-ghost text-sm font-medium ${isActive('/my-bids')}`}>
                            <span className="hidden sm:flex items-center gap-1.5">
                                <Bell size={16} /> My Bids
                            </span>
                        </Link>
                        <Link to="/chat/1" className={`btn-ghost ${isActive('/chat/1')}`}>
                            <MessageCircle size={20} />
                        </Link>
                        <Link to="/wallet" className={`btn-ghost ${isActive('/wallet')}`}>
                            <Wallet size={20} />
                        </Link>
                        <Link to="/listings/new" className="btn-primary text-sm flex items-center gap-1.5 ml-2">
                            <Plus size={16} /> Sell
                        </Link>

                        {/* Auth section */}
                        {user ? (
                            /* ── Logged-in avatar dropdown ── */
                            <div className="relative ml-1" ref={dropdownRef}>
                                <button
                                    id="navbar-user-menu"
                                    onClick={() => setDropdownOpen((o) => !o)}
                                    className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl hover:bg-orange-50 transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold shadow">
                                        {initials}
                                    </div>
                                    <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[100px] truncate">
                                        {user.name.split(' ')[0]}
                                    </span>
                                </button>

                                {dropdownOpen && (
                                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 animate-fade-in">
                                        <div className="px-4 py-3 border-b border-gray-50">
                                            <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                                            <p className="text-xs text-gray-400 truncate">{user.email}</p>
                                        </div>
                                        <Link
                                            to="/wallet"
                                            onClick={() => setDropdownOpen(false)}
                                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                                        >
                                            <Wallet size={15} /> Wallet
                                        </Link>
                                        <Link
                                            to="/my-bids"
                                            onClick={() => setDropdownOpen(false)}
                                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                                        >
                                            <Bell size={15} /> My Bids
                                        </Link>
                                        <div className="border-t border-gray-50 mt-1" />
                                        <button
                                            id="navbar-logout-btn"
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            <LogOut size={15} /> Sign Out
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* ── Logged-out login button ── */
                            <Link
                                to="/login"
                                id="navbar-login-btn"
                                className="ml-1 btn-ghost flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-orange-600"
                            >
                                <LogIn size={18} /> <span className="hidden sm:block">Sign In</span>
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    )
}
