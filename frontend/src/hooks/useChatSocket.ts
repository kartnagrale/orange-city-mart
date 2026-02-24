import { useEffect, useRef, useState, useCallback } from 'react'
import { WS_URL } from '../config'

export interface ChatMessage {
    id: string
    room_id: string
    sender_id: string
    sender_name: string
    body: string | null
    image_url: string | null
    created_at: string
}

interface UseChatSocketOptions {
    roomId: string
    userId: string
}

/**
 * useChatSocket — connects to the Go WS hub for a specific chat room.
 *
 * Listens for `chat_message` events and returns them via `lastMessage`.
 * The hook also exposes a `sendViaWS` helper to send a `chat_send` frame
 * directly over the socket (alternative to the HTTP POST endpoint).
 */
export function useChatSocket({ roomId, userId }: UseChatSocketOptions) {
    const [lastMessage, setLastMessage] = useState<ChatMessage | null>(null)
    const [isConnected, setIsConnected] = useState(false)
    const wsRef = useRef<WebSocket | null>(null)
    const retryCount = useRef(0)
    const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const connect = useCallback(() => {
        if (!roomId || !userId) return

        const url = `${WS_URL}?user_id=${userId}&room_id=${roomId}`

        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
            setIsConnected(true)
            retryCount.current = 0
        }

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data) as { type: string; payload: ChatMessage }
                if (msg.type === 'chat_message') {
                    setLastMessage(msg.payload)
                }
            } catch {
                // ignore parse errors
            }
        }

        ws.onclose = () => {
            setIsConnected(false)
            if (retryCount.current < 5) {
                const delay = Math.min(1000 * 2 ** retryCount.current, 15000)
                retryTimer.current = setTimeout(() => {
                    retryCount.current++
                    connect()
                }, delay)
            }
        }

        ws.onerror = () => ws.close()
    }, [roomId, userId])

    useEffect(() => {
        connect()
        return () => {
            retryTimer.current && clearTimeout(retryTimer.current)
            wsRef.current?.close()
        }
    }, [connect])

    return { lastMessage, isConnected }
}
