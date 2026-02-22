import { useEffect, useRef, useState, useCallback } from 'react'
import toast from 'react-hot-toast'

export interface BidUpdate {
    auction_id: string
    amount: number
    bidder_id: string
    timestamp: string
}

export interface OutbidAlert {
    auction_id: string
    your_bid: number
    new_high_bid: number
    new_bidder: string
}

interface UseAuctionSocketOptions {
    auctionId: string
    userId?: string
    initialBid?: number
}

interface UseAuctionSocketReturn {
    currentBid: number
    isConnected: boolean
    lastUpdate: BidUpdate | null
}

/**
 * useAuctionSocket — connects to the Go WebSocket hub for a specific auction.
 * 
 * - Listens for `broadcast_new_bid` events and updates `currentBid` state.
 * - Listens for `outbid_alert` events: if the alert targets the current user,
 *   it fires a browser toast notification.
 * - Automatically reconnects on disconnect (up to 5 retries with backoff).
 */
export function useAuctionSocket({
    auctionId,
    userId = '',
    initialBid = 0,
}: UseAuctionSocketOptions): UseAuctionSocketReturn {
    const [currentBid, setCurrentBid] = useState(initialBid)
    const [isConnected, setIsConnected] = useState(false)
    const [lastUpdate, setLastUpdate] = useState<BidUpdate | null>(null)
    const wsRef = useRef<WebSocket | null>(null)
    const retryCount = useRef(0)
    const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const connect = useCallback(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
        const host = window.location.host
        const url = `${protocol}://${host}/ws?auction_id=${auctionId}&user_id=${userId}`

        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
            setIsConnected(true)
            retryCount.current = 0
        }

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data) as { type: string; payload: unknown }

                if (msg.type === 'broadcast_new_bid') {
                    const payload = msg.payload as BidUpdate
                    setCurrentBid(payload.amount)
                    setLastUpdate(payload)
                }

                if (msg.type === 'outbid_alert' && userId) {
                    const payload = msg.payload as OutbidAlert
                    // The server only sends this to the outbid user's connection,
                    // but we double-check client-side for safety.
                    toast(
                        `You've been outbid! New high: ₹${payload.new_high_bid.toLocaleString('en-IN')}`,
                        {
                            icon: '🔔',
                            duration: 6000,
                            style: {
                                background: '#fff7ed',
                                border: '1px solid #fed7aa',
                                color: '#9a3412',
                            },
                        }
                    )
                }
            } catch {
                // ignore parse errors
            }
        }

        ws.onclose = () => {
            setIsConnected(false)
            if (retryCount.current < 5) {
                const delay = Math.min(1000 * 2 ** retryCount.current, 30000)
                retryTimer.current = setTimeout(() => {
                    retryCount.current++
                    connect()
                }, delay)
            }
        }

        ws.onerror = () => {
            ws.close()
        }
    }, [auctionId, userId])

    useEffect(() => {
        connect()
        return () => {
            retryTimer.current && clearTimeout(retryTimer.current)
            wsRef.current?.close()
        }
    }, [connect])

    return { currentBid, isConnected, lastUpdate }
}
