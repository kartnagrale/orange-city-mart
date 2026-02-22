import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
    MapPin, Heart, Share2, ChevronRight, Tag,
    MessageCircle, Phone, CheckCircle, AlertCircle, Loader2
} from 'lucide-react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'

interface ProductDetail {
    id: string
    seller_id: string
    seller_name: string
    seller_upi_id: string | null
    title: string
    description: string
    category: string
    type: string
    price: number
    image_url: string | null
    location: string
}

function maskUPI(upi: string): string {
    const at = upi.indexOf('@')
    if (at <= 0) return upi
    const name = upi.slice(0, at)
    const masked = name.length <= 3 ? name[0] + '***' : name.slice(0, 3) + '***'
    return masked + upi.slice(at)
}

export default function FixedListingDetail() {
    const { id } = useParams<{ id: string }>()
    const { user, token } = useAuth()
    const [product, setProduct] = useState<ProductDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!id) return
        const headers: Record<string, string> = {}
        if (token) headers.Authorization = `Bearer ${token}`
        fetch(`/api/products/${id}`, { headers })
            .then(async r => {
                if (!r.ok) throw new Error('Listing not found')
                return r.json()
            })
            .then(setProduct)
            .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
            .finally(() => setLoading(false))
    }, [id, token])

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="flex items-center justify-center py-48">
                    <Loader2 size={36} className="animate-spin text-orange-500" />
                </div>
            </div>
        )
    }

    if (error || !product) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="flex flex-col items-center justify-center py-48 gap-4 text-gray-400">
                    <AlertCircle size={48} className="opacity-30" />
                    <p className="text-lg font-medium">{error || 'Listing not found'}</p>
                    <Link to="/dashboard" className="btn-primary">Back to Dashboard</Link>
                </div>
            </div>
        )
    }

    const isSeller = user?.id === product.seller_id

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            {/* Breadcrumb */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                <nav className="flex items-center gap-2 text-sm text-gray-400">
                    <a href="/" className="hover:text-orange-500">Home</a>
                    <ChevronRight size={14} />
                    <a href="/dashboard" className="hover:text-orange-500">{product.category}</a>
                    <ChevronRight size={14} />
                    <span className="text-gray-700 truncate max-w-xs">{product.title}</span>
                </nav>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left: Image + Description */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Image */}
                        <div className="card overflow-hidden relative group">
                            <img
                                src={product.image_url ?? 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80'}
                                alt={product.title}
                                className="w-full h-96 object-cover"
                            />
                            <div className="absolute top-4 right-4 flex gap-2">
                                <button className="bg-white/90 backdrop-blur p-2 rounded-full shadow hover:bg-white transition-all">
                                    <Heart size={18} className="text-gray-600" />
                                </button>
                                <button className="bg-white/90 backdrop-blur p-2 rounded-full shadow hover:bg-white transition-all">
                                    <Share2 size={18} className="text-gray-600" />
                                </button>
                            </div>
                            <div className="absolute bottom-4 left-4">
                                <span className="badge-fixed text-sm">✓ Fixed Price</span>
                            </div>
                        </div>

                        {/* Title */}
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{product.title}</h1>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="flex items-center gap-1 text-gray-400 text-sm">
                                    <MapPin size={14} /> {product.location}
                                </span>
                                <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                    <Tag size={11} /> {product.category}
                                </span>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="card p-6">
                            <h2 className="font-bold text-gray-900 mb-3">Description</h2>
                            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{product.description}</p>
                        </div>

                        {/* How it works for fixed listings */}
                        <div className="card p-5 bg-blue-50 border border-blue-100">
                            <h3 className="font-semibold text-blue-800 text-sm mb-2">How fixed listings work</h3>
                            <ol className="space-y-1 text-xs text-blue-700 list-decimal list-inside">
                                <li>Contact the seller via the chat to discuss and confirm</li>
                                <li>Agree on a time and place to meet in Nagpur</li>
                                <li>Inspect the item and complete the transaction offline</li>
                            </ol>
                        </div>
                    </div>

                    {/* Right: Price + Seller */}
                    <div className="space-y-4">
                        {/* Price card */}
                        <div className="card p-6 space-y-4">
                            <div>
                                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Asking Price</p>
                                <p className="text-4xl font-bold text-green-600">
                                    ₹{product.price.toLocaleString('en-IN')}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">Fixed · No bidding required</p>
                            </div>

                            {!isSeller && (
                                <>
                                    <Link
                                        to={`/chat/${product.seller_id}`}
                                        className="btn-primary w-full flex items-center justify-center gap-2"
                                    >
                                        <MessageCircle size={18} /> Message Seller
                                    </Link>
                                    {product.seller_upi_id && (
                                        <p className="text-xs text-center text-gray-400">
                                            <Phone size={11} className="inline mr-1" />
                                            Pay via UPI: <span className="font-mono">{maskUPI(product.seller_upi_id)}</span>
                                        </p>
                                    )}
                                </>
                            )}

                            {isSeller && (
                                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center text-sm text-orange-700">
                                    This is your listing
                                </div>
                            )}
                        </div>

                        {/* Seller card */}
                        <div className="card p-5 space-y-3">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Seller</p>
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-bold text-white text-lg">
                                    {product.seller_name[0]}
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">{product.seller_name}</p>
                                    <p className="flex items-center gap-1 text-xs text-green-600">
                                        <CheckCircle size={12} /> Verified member
                                    </p>
                                </div>
                            </div>
                            {!isSeller && (
                                <Link
                                    to={`/chat/${product.seller_id}`}
                                    className="btn-outline w-full flex items-center justify-center gap-2 text-sm"
                                >
                                    <MessageCircle size={15} /> Open Chat
                                </Link>
                            )}
                        </div>

                        {/* Safety tip */}
                        <div className="card p-4 bg-amber-50 border border-amber-100">
                            <p className="text-xs text-amber-700 font-semibold mb-1">🛡 Safety Tips</p>
                            <ul className="text-xs text-amber-600 space-y-0.5 list-disc list-inside">
                                <li>Meet in a public place</li>
                                <li>Inspect before paying</li>
                                <li>Never pay in advance</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
