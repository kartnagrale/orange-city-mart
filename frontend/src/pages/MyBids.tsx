import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Gavel, Clock, Trophy, AlertCircle, ArrowUpCircle, Loader2 } from 'lucide-react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { API_URL } from '../config'

type BidStatus = 'WINNING' | 'OUTBID' | 'WON' | 'LOST'

interface ApiBid {
    id: string
    amount: number
    placed_at: string
    auction_id: string
    current_high_bid: number
    end_time: string
    auction_status: string
    highest_bidder_id: string | null
    product_id: string
    product_title: string
    product_image_url: string | null
    is_winning: boolean
}

const statusConfig: Record<BidStatus, { label: string; color: string; bg: string; icon: ReactNode }> = {
    WINNING: { label: 'Winning', color: 'text-green-700', bg: 'bg-green-100', icon: <Trophy size={14} /> },
    OUTBID: { label: 'Outbid', color: 'text-red-600', bg: 'bg-red-100', icon: <AlertCircle size={14} /> },
    WON: { label: 'Won!', color: 'text-orange-600', bg: 'bg-orange-100', icon: <Trophy size={14} /> },
    LOST: { label: 'Ended', color: 'text-gray-500', bg: 'bg-gray-100', icon: <Clock size={14} /> },
}

function getBidStatus(bid: ApiBid): BidStatus {
    const ended = bid.auction_status !== 'ACTIVE' || new Date(bid.end_time) < new Date()
    if (ended) return bid.is_winning ? 'WON' : 'LOST'
    return bid.is_winning ? 'WINNING' : 'OUTBID'
}

function fmt(iso: string) {
    const diff = new Date(iso).getTime() - Date.now()
    if (diff <= 0) return 'Ended'
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Deduplicate: keep only the latest bid per auction
function dedupe(bids: ApiBid[]): ApiBid[] {
    const map = new Map<string, ApiBid>()
    for (const b of bids) {
        if (!map.has(b.auction_id) || new Date(b.placed_at) > new Date(map.get(b.auction_id)!.placed_at)) {
            map.set(b.auction_id, b)
        }
    }
    return Array.from(map.values())
}

export default function MyBids() {
    const { token } = useAuth()
    const [bids, setBids] = useState<ApiBid[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!token) return
        fetch(`${API_URL}/bids`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(data => setBids(dedupe(data)))
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [token])

    const withStatus = bids.map(b => ({ ...b, bidStatus: getBidStatus(b) }))
    const active = withStatus.filter(b => b.bidStatus === 'WINNING' || b.bidStatus === 'OUTBID')
    const past = withStatus.filter(b => b.bidStatus === 'WON' || b.bidStatus === 'LOST')

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Gavel size={28} className="text-orange-500" /> My Bids
                    </h1>
                    <p className="text-gray-400 mt-1">Track all your active and past auction bids</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-24 text-gray-400"><Loader2 size={36} className="animate-spin" /></div>
                ) : bids.length === 0 ? (
                    <div className="card p-16 text-center text-gray-400">
                        <Gavel size={48} className="mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-medium">No bids yet</p>
                        <p className="text-sm mt-1">Browse auctions and place your first bid!</p>
                        <Link to="/dashboard" className="btn-primary mt-6 inline-flex">Browse Auctions</Link>
                    </div>
                ) : (
                    <>
                        {/* Stats */}
                        <div className="grid grid-cols-4 gap-4 mb-8">
                            {[
                                { label: 'Active Bids', val: active.length, color: 'text-blue-600' },
                                { label: 'Winning', val: active.filter(b => b.bidStatus === 'WINNING').length, color: 'text-green-600' },
                                { label: 'Outbid', val: active.filter(b => b.bidStatus === 'OUTBID').length, color: 'text-red-500' },
                                { label: 'Won', val: past.filter(b => b.bidStatus === 'WON').length, color: 'text-orange-500' },
                            ].map(({ label, val, color }) => (
                                <div key={label} className="card p-4 text-center">
                                    <p className={`text-3xl font-bold ${color}`}>{val}</p>
                                    <p className="text-xs text-gray-400 mt-1">{label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Active Bids */}
                        {active.length > 0 && (
                            <section className="mb-8">
                                <h2 className="section-title mb-4">Active Bids</h2>
                                <div className="space-y-3">
                                    {active.map((bid) => {
                                        const cfg = statusConfig[bid.bidStatus]
                                        return (
                                            <div key={bid.id} className="card p-4 flex items-center gap-4">
                                                <img src={bid.product_image_url ?? ''} alt={bid.product_title} className="w-20 h-16 object-cover rounded-xl flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <Link to={`/auctions/${bid.auction_id}`} className="font-semibold text-gray-900 hover:text-orange-600 transition-colors text-sm truncate">{bid.product_title}</Link>
                                                        <span className={`${cfg.bg} ${cfg.color} text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0`}>
                                                            {cfg.icon} {cfg.label}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-2 text-sm">
                                                        <div>
                                                            <p className="text-xs text-gray-400">Your Bid</p>
                                                            <p className="font-semibold text-gray-900">₹{bid.amount.toLocaleString('en-IN')}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-400">High Bid</p>
                                                            <p className={`font-semibold ${bid.bidStatus === 'WINNING' ? 'text-green-600' : 'text-red-500'}`}>₹{bid.current_high_bid.toLocaleString('en-IN')}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-400">Time Left</p>
                                                            <p className="font-mono font-semibold text-orange-600">{fmt(bid.end_time)}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                {bid.bidStatus === 'OUTBID' && (
                                                    <Link to={`/auctions/${bid.auction_id}`} className="btn-primary text-sm flex items-center gap-1 flex-shrink-0">
                                                        <ArrowUpCircle size={15} /> Raise Bid
                                                    </Link>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </section>
                        )}

                        {/* Past Bids */}
                        {past.length > 0 && (
                            <section>
                                <h2 className="section-title mb-4">Past Auctions</h2>
                                <div className="space-y-3">
                                    {past.map((bid) => {
                                        const cfg = statusConfig[bid.bidStatus]
                                        return (
                                            <div key={bid.id} className="card p-4 flex items-center gap-4 opacity-80">
                                                <img src={bid.product_image_url ?? ''} alt={bid.product_title} className="w-20 h-16 object-cover rounded-xl flex-shrink-0 grayscale" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <p className="font-semibold text-gray-900 text-sm truncate">{bid.product_title}</p>
                                                        <span className={`${cfg.bg} ${cfg.color} text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0`}>
                                                            {cfg.icon} {cfg.label}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-2 text-sm">
                                                        <div>
                                                            <p className="text-xs text-gray-400">Your Final Bid</p>
                                                            <p className="font-semibold text-gray-700">₹{bid.amount.toLocaleString('en-IN')}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-400">Final Price</p>
                                                            <p className="font-semibold text-gray-700">₹{bid.current_high_bid.toLocaleString('en-IN')}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </section>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
