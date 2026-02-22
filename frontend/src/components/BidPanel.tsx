import { useState, useEffect } from 'react'
import { Gavel, Wifi, WifiOff, Clock, Wallet, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuctionSocket } from '../hooks/useAuctionSocket'

interface BidPanelProps {
    auctionId: string
    endTime: string          // ISO 8601
    initialBid: number
    startPrice: number
    userId: string
    walletBalance: number
    token: string | null
}

function useCountdown(endTime: string) {
    const [remaining, setRemaining] = useState(() =>
        Math.max(0, new Date(endTime).getTime() - Date.now())
    )
    useEffect(() => {
        const interval = setInterval(() => {
            setRemaining(Math.max(0, new Date(endTime).getTime() - Date.now()))
        }, 1000)
        return () => clearInterval(interval)
    }, [endTime])

    const hours = Math.floor(remaining / 3_600_000)
    const minutes = Math.floor((remaining % 3_600_000) / 60_000)
    const seconds = Math.floor((remaining % 60_000) / 1000)
    const expired = remaining === 0
    return { hours, minutes, seconds, expired }
}

export default function BidPanel({
    auctionId,
    endTime,
    initialBid,
    startPrice,
    userId,
    walletBalance,
    token,
}: BidPanelProps) {
    const { currentBid, isConnected } = useAuctionSocket({ auctionId, userId, initialBid })
    const { hours, minutes, seconds, expired } = useCountdown(endTime)
    const [bidAmount, setBidAmount] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const minBid = Math.max(startPrice, currentBid) + 1
    const parsedAmount = parseFloat(bidAmount)
    const isInsufficient = !isNaN(parsedAmount) && parsedAmount > walletBalance
    const balanceAfterBid = !isNaN(parsedAmount) ? walletBalance - parsedAmount : walletBalance

    const handleBid = async () => {
        if (isNaN(parsedAmount) || parsedAmount < minBid) {
            toast.error(`Minimum bid is ₹${minBid.toLocaleString('en-IN')}`)
            return
        }
        if (parsedAmount > walletBalance) {
            toast.error('Insufficient wallet balance')
            return
        }
        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/auctions/${auctionId}/bid`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ amount: parsedAmount }),
            })
            if (!res.ok) {
                const text = await res.text()
                throw new Error(text.trim() || 'Bid failed')
            }
            toast.success(`Bid of ₹${parsedAmount.toLocaleString('en-IN')} placed! Funds soft-blocked.`)
            setBidAmount('')
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to place bid')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="card p-6 space-y-5">
            {/* Connection status */}
            <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Live Auction</span>
                <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                    {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                    {isConnected ? 'Connected' : 'Reconnecting…'}
                </span>
            </div>

            {/* Current bid */}
            <div className="bg-orange-50 rounded-xl p-4 text-center">
                <p className="text-sm text-orange-700 font-medium mb-1">Current Highest Bid</p>
                <p className="text-4xl font-bold text-orange-600">
                    ₹{currentBid > 0 ? currentBid.toLocaleString('en-IN') : startPrice.toLocaleString('en-IN')}
                </p>
            </div>

            {/* Countdown */}
            <div className="flex items-center justify-center gap-2">
                <Clock size={18} className="text-gray-400" />
                {expired ? (
                    <span className="text-red-500 font-bold text-lg">Auction Ended</span>
                ) : (
                    <span className="countdown">
                        {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                    </span>
                )}
            </div>

            {/* Wallet balance */}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <span className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Wallet size={14} /> Your Wallet
                </span>
                <span className="text-sm font-bold text-gray-800">
                    ₹{walletBalance.toLocaleString('en-IN')}
                </span>
            </div>

            {/* Bid input */}
            {!expired && (
                <div className="space-y-3">
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₹</span>
                        <input
                            type="number"
                            className={`input pl-8 ${isInsufficient ? 'border-red-400 focus:ring-red-300' : ''}`}
                            placeholder={`Min. ₹${minBid.toLocaleString('en-IN')}`}
                            value={bidAmount}
                            min={minBid}
                            onChange={(e) => setBidAmount(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleBid()}
                        />
                    </div>

                    {/* Insufficient balance warning */}
                    {isInsufficient && (
                        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            <AlertCircle size={14} />
                            <span>Insufficient wallet balance. <a href="/wallet" className="underline font-semibold">Add funds →</a></span>
                        </div>
                    )}

                    {/* Balance after bid preview */}
                    {!isInsufficient && bidAmount && !isNaN(parsedAmount) && parsedAmount >= minBid && (
                        <p className="text-xs text-gray-400 text-center">
                            Balance after bid: <span className="font-semibold text-gray-600">₹{balanceAfterBid.toLocaleString('en-IN')}</span>
                        </p>
                    )}

                    <button
                        onClick={handleBid}
                        disabled={isSubmitting || !isConnected || isInsufficient}
                        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <Gavel size={18} />
                        {isSubmitting ? 'Placing bid…' : 'Place Bid'}
                    </button>
                    <p className="text-xs text-center text-gray-400">
                        Bid amount is <strong>soft-blocked</strong> from your wallet. Released instantly if outbid.
                    </p>
                </div>
            )}
        </div>
    )
}
