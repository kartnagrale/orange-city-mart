import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Gavel, Clock, MapPin, Zap, Tag, Loader2 } from 'lucide-react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { API_URL } from '../config'

interface Product {
    id: string
    title: string
    category: string
    type: 'FIXED' | 'AUCTION'
    price: number
    image_url: string | null
    location: string
    auction_id: string | null
    current_bid: number | null
    end_time: string | null
}

const CATEGORIES = [
    { label: 'All Categories', icon: '🛒' },
    { label: 'Electronics', icon: '💻' },
    { label: 'Furniture', icon: '🪑' },
    { label: 'Fashion', icon: '👗' },
    { label: 'Vehicles', icon: '🚗' },
    { label: 'Music', icon: '🎸' },
]

function TimeLeft({ endTime }: { endTime: string }) {
    const [left, setLeft] = useState('')
    useEffect(() => {
        const calc = () => {
            const diff = new Date(endTime).getTime() - Date.now()
            if (diff <= 0) { setLeft('Ended'); return }
            const h = Math.floor(diff / 3600000)
            const m = Math.floor((diff % 3600000) / 60000)
            const s = Math.floor((diff % 60000) / 1000)
            setLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
        }
        calc()
        const t = setInterval(calc, 1000)
        return () => clearInterval(t)
    }, [endTime])
    return <span>{left}</span>
}

export default function Dashboard() {
    const { token } = useAuth()
    const [activeCategory, setActiveCategory] = useState('All Categories')
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const cat = activeCategory === 'All Categories' ? '' : activeCategory
        fetch(`${API_URL}/products?category=${encodeURIComponent(cat)}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
            .then(r => r.json())
            .then(setProducts)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [activeCategory, token])

    const auctions = products.filter(p => p.type === 'AUCTION' && p.auction_id)
    const fixed = products.filter(p => p.type === 'FIXED')

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex gap-6">
                    {/* Sidebar */}
                    <aside className="hidden lg:block w-56 flex-shrink-0">
                        <div className="card p-4 mb-4">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Categories</p>
                            <nav className="space-y-1">
                                {CATEGORIES.map((cat) => (
                                    <button
                                        key={cat.label}
                                        onClick={() => setActiveCategory(cat.label)}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${activeCategory === cat.label
                                            ? 'bg-orange-50 text-orange-700 font-semibold'
                                            : 'text-gray-600 hover:bg-gray-50'
                                            }`}
                                    >
                                        <span>{cat.icon}</span> {cat.label}
                                    </button>
                                ))}
                            </nav>
                        </div>
                        <div className="card p-4 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                            <Zap size={20} className="mb-2" />
                            <p className="font-bold text-sm mb-1">Sell faster!</p>
                            <p className="text-xs text-orange-100">Post a listing and reach buyers across Nagpur.</p>
                            <Link to="/listings/new" className="mt-3 bg-white text-orange-600 text-xs font-bold px-3 py-1.5 rounded-lg w-full block text-center">Sell Now</Link>
                        </div>
                    </aside>

                    {/* Main content */}
                    <div className="flex-1 min-w-0 space-y-8">
                        {loading ? (
                            <div className="flex items-center justify-center py-24 text-gray-400">
                                <Loader2 size={36} className="animate-spin" />
                            </div>
                        ) : (
                            <>
                                {/* Auctions Ending Soon */}
                                {auctions.length > 0 && (
                                    <section>
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="section-title flex items-center gap-2"><Gavel size={22} className="text-orange-500" /> Auctions Ending Soon</h2>
                                            <Link to="/search?type=AUCTION" className="text-orange-600 hover:text-orange-700 text-sm font-semibold flex items-center gap-1">
                                                View All <ArrowRight size={16} />
                                            </Link>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            {auctions.slice(0, 3).map((a) => (
                                                <Link key={a.id} to={`/auctions/${a.auction_id}`} className="card overflow-hidden group block">
                                                    <div className="relative overflow-hidden">
                                                        <img src={a.image_url ?? 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=400&q=80'} alt={a.title} className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300" />
                                                        {a.end_time && (
                                                            <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                                                <Clock size={10} /> <TimeLeft endTime={a.end_time} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="p-3">
                                                        <p className="font-semibold text-sm text-gray-900 truncate">{a.title}</p>
                                                        <p className="text-xs text-gray-400 mt-0.5">Current Bid</p>
                                                        <p className="price-tag text-base">₹{(a.current_bid ?? a.price).toLocaleString('en-IN')}</p>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* Fresh Finds */}
                                {products.length > 0 && (
                                    <section>
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="section-title flex items-center gap-2"><Tag size={22} className="text-orange-500" /> Fresh Finds in Nagpur</h2>
                                            <Link to="/search" className="text-orange-600 text-sm font-semibold flex items-center gap-1">
                                                See more <ArrowRight size={16} />
                                            </Link>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                            {(fixed.length > 0 ? fixed : products).slice(0, 6).map((item) => (
                                                <Link key={item.id} to={item.type === 'FIXED' ? `/listings/${item.id}` : `/auctions/${item.auction_id}`} className="card overflow-hidden group block">
                                                    <div className="overflow-hidden">
                                                        <img src={item.image_url ?? ''} alt={item.title} className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300" />
                                                    </div>
                                                    <div className="p-4">
                                                        <h3 className="font-semibold text-gray-900 text-sm mb-1 truncate">{item.title}</h3>
                                                        <p className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                                                            <MapPin size={12} /> {item.location}
                                                        </p>
                                                        <p className="price-tag">₹{item.price.toLocaleString('en-IN')}</p>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {products.length === 0 && (
                                    <div className="text-center py-24 text-gray-400">
                                        <Tag size={48} className="mx-auto mb-4 opacity-30" />
                                        <p className="text-lg font-medium">No listings yet</p>
                                        <Link to="/listings/new" className="btn-primary mt-4 inline-flex">Post First Listing</Link>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
