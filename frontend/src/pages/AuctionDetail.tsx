import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
    MapPin, Heart, Share2, ChevronRight, Gavel, Clock,
    CheckCircle, HandshakeIcon, AlertCircle, Hourglass, RefreshCw
} from 'lucide-react'
import Navbar from '../components/Navbar'
import BidPanel from '../components/BidPanel'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { API_URL } from '../config'

interface AuctionData {
    id: string
    product_id: string
    title: string
    description: string
    image_url: string | null
    seller_id: string
    seller_name: string
    start_price: number
    current_highest_bid: number
    highest_bidder_id: string | null
    end_time: string
    status: 'ACTIVE' | 'ENDED' | 'CANCELLED'
    winner_approved_at: string | null
    seller_approved_at: string | null
    settlement_status: 'PENDING' | 'COMPLETED' | null
}

interface BidHistory {
    amount: number
    placed_at: string
    bidder_tag: string
}

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
}

// ── Settlement Panel ─────────────────────────────────────────────────────────
function SettlementPanel({
    auctionId,
    isWinner,
    isSeller,
    winnerApproved,
    sellerApproved,
    settlementStatus,
    amount,
    token,
    onApproved,
}: {
    auctionId: string
    isWinner: boolean
    isSeller: boolean
    winnerApproved: boolean
    sellerApproved: boolean
    settlementStatus: 'PENDING' | 'COMPLETED' | null
    amount: number
    token: string | null
    onApproved: () => void
}) {
    const [loading, setLoading] = useState(false)

    if (settlementStatus === 'COMPLETED') {
        return (
            <div className="card p-6 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 space-y-3">
                <div className="flex items-center gap-2 text-green-700 font-bold text-lg">
                    <CheckCircle size={22} /> Settlement Complete
                </div>
                {isWinner && (
                    <p className="text-sm text-green-600">
                        ₹{amount.toLocaleString('en-IN')} transferred to the seller. Item is yours!
                    </p>
                )}
                {isSeller && (
                    <p className="text-sm text-green-600">
                        ₹{amount.toLocaleString('en-IN')} has been added to your wallet.
                    </p>
                )}
            </div>
        )
    }

    const myApproval = isWinner ? winnerApproved : sellerApproved
    const otherApproval = isWinner ? sellerApproved : winnerApproved
    const myRole = isWinner ? 'winner' : 'seller'
    const otherRole = isWinner ? 'seller' : 'winner'

    const handleApprove = async () => {
        setLoading(true)
        try {
            const res = await fetch(`${API_URL}/auctions/${auctionId}/settle`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            })
            if (!res.ok) {
                const text = await res.text()
                throw new Error(text.trim() || 'Approval failed')
            }
            toast.success('Approval recorded!')
            onApproved()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to approve')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="card p-6 space-y-4 border-2 border-orange-200 bg-orange-50">
            <div className="flex items-center gap-2 text-orange-800 font-bold">
                <HandshakeIcon size={20} /> Settlement Required
            </div>
            <p className="text-sm text-orange-700">
                The auction has ended. Once both parties confirm the offline handoff,
                <span className="font-bold"> ₹{amount.toLocaleString('en-IN')} </span>
                will be transferred to the seller.
            </p>

            {/* Approval status indicators */}
            <div className="space-y-2">
                <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${winnerApproved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {winnerApproved ? <CheckCircle size={15} /> : <Hourglass size={15} />}
                    <span>Winner {winnerApproved ? 'confirmed receipt' : 'has not confirmed yet'}</span>
                </div>
                <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${sellerApproved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {sellerApproved ? <CheckCircle size={15} /> : <Hourglass size={15} />}
                    <span>Seller {sellerApproved ? 'confirmed handoff' : 'has not confirmed yet'}</span>
                </div>
            </div>

            {/* CTA */}
            {myApproval ? (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertCircle size={14} />
                    Waiting for the {otherRole} to confirm…
                </div>
            ) : (isSeller || isWinner) ? (
                <button
                    onClick={handleApprove}
                    disabled={loading}
                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
                >
                    <HandshakeIcon size={16} />
                    {loading
                        ? 'Confirming…'
                        : isWinner
                            ? '✓ I received the item'
                            : '✓ I handed over the item'}
                </button>
            ) : null}

            {!isSeller && !isWinner && (
                <p className="text-xs text-gray-400 text-center">You are observing this auction's settlement.</p>
            )}
            <p className="text-xs text-gray-400 text-center">
                {myApproval ? `You approved as ${myRole}. ` : ''}
                {otherApproval ? `${otherRole.charAt(0).toUpperCase() + otherRole.slice(1)} has also approved. ` : ''}
            </p>
        </div>
    )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function AuctionDetail() {
    const { id } = useParams<{ id: string }>()
    const { user, token } = useAuth()

    const [auction, setAuction] = useState<AuctionData | null>(null)
    const [bids, setBids] = useState<BidHistory[]>([])
    const [walletBalance, setWalletBalance] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const fetchAll = async () => {
        if (!id) return
        try {
            const headers: Record<string, string> = {}
            if (token) headers.Authorization = `Bearer ${token}`

            const [aRes, bRes, wRes] = await Promise.all([
                fetch(`${API_URL}/auctions/${id}`, { headers }),
                fetch(`${API_URL}/auctions/${id}/bids`, { headers }),
                token ? fetch(`${API_URL}/wallet`, { headers }) : Promise.resolve(null),
            ])

            if (!aRes.ok) throw new Error('Auction not found')
            const aData: AuctionData = await aRes.json()
            setAuction(aData)

            const bData: BidHistory[] = await bRes.json()
            setBids(bData)

            if (wRes && wRes.ok) {
                const wData = await wRes.json()
                setWalletBalance(wData.balance ?? 0)
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load auction')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchAll() }, [id, token])

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="flex items-center justify-center py-48 text-gray-400">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
                </div>
            </div>
        )
    }

    if (error || !auction) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="flex flex-col items-center justify-center py-48 gap-4 text-gray-400">
                    <AlertCircle size={48} className="opacity-30" />
                    <p className="text-lg font-medium">{error || 'Auction not found'}</p>
                    <Link to="/dashboard" className="btn-primary">Back to Dashboard</Link>
                </div>
            </div>
        )
    }

    const isWinner = !!(user && auction.highest_bidder_id === user.id)
    const isSeller = !!(user && auction.seller_id === user.id)

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            {/* Breadcrumb */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                <nav className="flex items-center gap-2 text-sm text-gray-400">
                    <a href="/" className="hover:text-orange-500">Home</a>
                    <ChevronRight size={14} />
                    <a href="/dashboard" className="hover:text-orange-500">Dashboard</a>
                    <ChevronRight size={14} />
                    <span className="text-gray-700 truncate max-w-xs">{auction.title}</span>
                </nav>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Image + Details */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Image */}
                        <div className="card overflow-hidden relative group">
                            <img
                                src={auction.image_url ?? 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&q=80'}
                                alt={auction.title}
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
                            <div className="absolute bottom-4 left-4 flex gap-2">
                                {auction.status === 'ACTIVE'
                                    ? <span className="badge-auction text-sm">🔨 Live Auction</span>
                                    : <span className="bg-gray-800/70 text-white text-sm px-3 py-1 rounded-full">Auction Ended</span>
                                }
                            </div>
                        </div>

                        {/* Title + seller */}
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{auction.title}</h1>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                                    <CheckCircle size={16} /> {auction.seller_name}
                                </span>
                                <span className="flex items-center gap-1 text-gray-400 text-sm">
                                    <MapPin size={14} /> Nagpur
                                </span>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="card p-6">
                            <h2 className="font-bold text-gray-900 mb-3">Description</h2>
                            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{auction.description}</p>
                        </div>

                        {/* Bid History */}
                        <div className="card p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-bold text-gray-900 flex items-center gap-2">
                                    <Clock size={18} className="text-orange-500" /> Bid History
                                </h2>
                                <button onClick={fetchAll} className="text-gray-400 hover:text-orange-500 transition-colors">
                                    <RefreshCw size={15} />
                                </button>
                            </div>
                            {bids.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-4">No bids yet. Be the first!</p>
                            ) : (
                                <div className="space-y-3">
                                    {bids.map((b, i) => (
                                        <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-800">{b.bidder_tag}</p>
                                                <p className="text-xs text-gray-400">{timeAgo(b.placed_at)}</p>
                                            </div>
                                            <p className="price-tag text-base">₹{b.amount.toLocaleString('en-IN')}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Auction ended info: show who won */}
                        {auction.status === 'ENDED' && auction.highest_bidder_id && (
                            <div className={`card p-4 flex items-center gap-3 border ${isWinner ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                                <Gavel size={20} className={isWinner ? 'text-green-600' : 'text-gray-400'} />
                                <div>
                                    <p className="text-sm font-bold text-gray-900">
                                        {isWinner ? '🎉 You won this auction!' : 'Auction concluded'}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Final bid: ₹{auction.current_highest_bid.toLocaleString('en-IN')}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: BidPanel or Settlement */}
                    <div className="space-y-4">
                        {auction.status === 'ACTIVE' ? (
                            <BidPanel
                                auctionId={auction.id}
                                endTime={auction.end_time}
                                initialBid={auction.current_highest_bid}
                                startPrice={auction.start_price}
                                userId={user?.id ?? ''}
                                walletBalance={walletBalance}
                                token={token}
                            />
                        ) : (
                            <div className="card p-6 text-center space-y-2">
                                <Gavel size={32} className="mx-auto text-gray-300" />
                                <p className="font-semibold text-gray-700">Auction Closed</p>
                                <p className="text-sm text-gray-400">
                                    Final price: ₹{auction.current_highest_bid.toLocaleString('en-IN')}
                                </p>
                            </div>
                        )}

                        {/* Settlement Panel (only for winner/seller after auction ends) */}
                        {auction.status === 'ENDED' && (
                            <SettlementPanel
                                auctionId={auction.id}
                                isWinner={isWinner}
                                isSeller={isSeller}
                                winnerApproved={!!auction.winner_approved_at}
                                sellerApproved={!!auction.seller_approved_at}
                                settlementStatus={auction.settlement_status}
                                amount={auction.current_highest_bid}
                                token={token}
                                onApproved={fetchAll}
                            />
                        )}

                        {/* Contact seller (only show during active bidding for now) */}
                        {auction.status === 'ACTIVE' && (
                            <Link to={`/chat/${auction.seller_id}`} className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow block">
                                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-600">
                                    {auction.seller_name[0]}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-900">{auction.seller_name}</p>
                                    <p className="text-xs text-orange-500">Message seller</p>
                                </div>
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
