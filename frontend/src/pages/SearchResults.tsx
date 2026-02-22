import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Search, SlidersHorizontal, MapPin, Clock, X, Loader2 } from 'lucide-react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'

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

const CATEGORIES = ['All', 'Electronics', 'Furniture', 'Vehicles', 'Fashion', 'Music']
const TYPES = ['All', 'FIXED', 'AUCTION']
const SORT_OPT = ['Relevance', 'Price: Low to High', 'Price: High to Low']

export default function SearchResults() {
    const [params] = useSearchParams()
    const { token } = useAuth()
    const [query, setQuery] = useState(params.get('q') || '')
    const [category, setCat] = useState('All')
    const [type, setType] = useState(params.get('type') || 'All')
    const [sort, setSort] = useState('Relevance')
    const [showFilters, setShowFilters] = useState(false)
    const [items, setItems] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        const qs = new URLSearchParams()
        if (query) qs.set('q', query)
        if (category !== 'All') qs.set('category', category)
        if (type !== 'All') qs.set('type', type)

        fetch(`/api/products?${qs.toString()}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
            .then(r => r.json())
            .then(data => {
                let results: Product[] = data
                if (sort === 'Price: Low to High') results = [...results].sort((a, b) => a.price - b.price)
                if (sort === 'Price: High to Low') results = [...results].sort((a, b) => b.price - a.price)
                setItems(results)
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [query, category, type, sort, token])

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Search bar */}
                <div className="flex gap-3 mb-6">
                    <div className="relative flex-1">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search products..."
                            className="input pl-11"
                        />
                        {query && (
                            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    <button onClick={() => setShowFilters(!showFilters)} className="btn-outline flex items-center gap-2">
                        <SlidersHorizontal size={16} /> Filters
                    </button>
                </div>

                {/* Filter panel */}
                {showFilters && (
                    <div className="card p-4 mb-6 space-y-4">
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Category</p>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map((c) => (
                                    <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${category === c ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-orange-100'}`}>{c}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Listing Type</p>
                            <div className="flex flex-wrap gap-2">
                                {TYPES.map((t) => (
                                    <button key={t} onClick={() => setType(t)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${type === t ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-orange-100'}`}>{t}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Results header */}
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-500">
                        <span className="font-semibold text-gray-900">{loading ? '…' : items.length}</span> results
                        {query && <> for "<span className="text-orange-600 font-medium">{query}</span>"</>}
                    </p>
                    <select value={sort} onChange={(e) => setSort(e.target.value)} className="input text-sm w-auto py-2">
                        {SORT_OPT.map((s) => <option key={s}>{s}</option>)}
                    </select>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="flex items-center justify-center py-24 text-gray-400">
                        <Loader2 size={36} className="animate-spin" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-24 text-gray-400">
                        <Search size={48} className="mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-medium">No results found</p>
                        <p className="text-sm mt-1">Try a different search term or clear filters</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {items.map((item) => (
                            <Link
                                key={item.id}
                                to={item.type === 'FIXED'
                                    ? `/listings/${item.id}`
                                    : `/auctions/${item.auction_id ?? item.id}`}
                                className="card overflow-hidden group block">
                                <div className="relative overflow-hidden">
                                    <img src={item.image_url ?? ''} alt={item.title} className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300" />
                                    <div className="absolute top-2 left-2">
                                        {item.type === 'AUCTION'
                                            ? <span className="badge-auction">🔨 Auction</span>
                                            : <span className="badge-fixed">✓ Fixed</span>}
                                    </div>
                                    {item.type === 'AUCTION' && item.end_time && (
                                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                            <Clock size={10} /> {new Date(item.end_time).toLocaleTimeString()}
                                        </div>
                                    )}
                                </div>
                                <div className="p-4">
                                    <h3 className="font-semibold text-sm text-gray-900 truncate">{item.title}</h3>
                                    <p className="flex items-center gap-1 text-xs text-gray-400 mt-1 mb-2">
                                        <MapPin size={12} /> {item.location}
                                    </p>
                                    <p className="price-tag">₹{(item.current_bid ?? item.price).toLocaleString('en-IN')}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
