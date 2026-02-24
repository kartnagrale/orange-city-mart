import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Send, Image as ImageIcon, X, Wifi, WifiOff,
    MessageSquare, CheckCheck, ChevronLeft, Loader2
} from 'lucide-react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { useChatSocket, type ChatMessage } from '../hooks/useChatSocket'
import toast from 'react-hot-toast'
import { API_URL } from '../config'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Deterministic room ID — must match backend roomID() function */
function buildRoomId(a: string, b: string): string {
    return [a, b].sort().join('_')
}

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60_000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Conversation {
    room_id: string
    other_user_id: string
    other_name: string
    last_body: string | null
    last_image_url: string | null
    last_at: string
}

// ── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    return (
        <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <button
                className="absolute top-4 right-4 text-white/70 hover:text-white"
                onClick={onClose}
            >
                <X size={28} />
            </button>
            <img
                src={src}
                alt="Full size"
                className="max-w-full max-h-full rounded-lg shadow-2xl"
                onClick={e => e.stopPropagation()}
            />
        </div>
    )
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({
    msg, isMe, onImageClick,
}: {
    msg: ChatMessage
    isMe: boolean
    onImageClick: (src: string) => void
}) {
    return (
        <div className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
            {!isMe && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-1">
                    {msg.sender_name[0]}
                </div>
            )}
            <div className={`max-w-xs lg:max-w-sm group ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                {msg.image_url ? (
                    <div
                        className={`rounded-2xl overflow-hidden shadow cursor-zoom-in ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                        onClick={() => onImageClick(msg.image_url!)}
                    >
                        <img
                            src={msg.image_url}
                            alt="Shared image"
                            className="max-w-[240px] max-h-[240px] object-cover hover:opacity-90 transition-opacity"
                        />
                    </div>
                ) : (
                    <div className={`px-4 py-2.5 rounded-2xl text-sm ${isMe
                        ? 'bg-orange-500 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                        }`}>
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                    </div>
                )}
                <div className={`flex items-center gap-1 mt-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="text-xs text-gray-400">{formatTime(msg.created_at)}</span>
                    {isMe && <CheckCheck size={11} className="text-orange-300" />}
                </div>
            </div>
        </div>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
    const { id: otherIdFromUrl } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { user, token } = useAuth()

    const [conversations, setConversations] = useState<Conversation[]>([])
    const [activeOtherId, setActiveOtherId] = useState<string>(otherIdFromUrl ?? '')
    const [activeOtherName, setActiveOtherName] = useState<string>('')
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [isSending, setIsSending] = useState(false)
    const [isLoadingMsgs, setIsLoadingMsgs] = useState(false)
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
    const [isUploadingImage, setIsUploadingImage] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const myId = user?.id ?? ''

    const currentRoomId = activeOtherId ? buildRoomId(myId, activeOtherId) : ''

    // ── WebSocket ──────────────────────────────────────────────────────────
    const { lastMessage, isConnected } = useChatSocket({
        roomId: currentRoomId,
        userId: myId,
    })

    useEffect(() => {
        if (lastMessage && lastMessage.room_id === currentRoomId) {
            setMessages(prev => {
                // Deduplicate by id (WS + HTTP POST can both arrive)
                if (prev.some(m => m.id === lastMessage.id)) return prev
                return [...prev, lastMessage]
            })
        }
    }, [lastMessage, currentRoomId])

    // ── Auto-scroll ────────────────────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // ── Auth headers ───────────────────────────────────────────────────────
    const authHeaders = useCallback((): Record<string, string> => {
        const h: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) h.Authorization = `Bearer ${token}`
        return h
    }, [token])

    // ── Fetch conversation list ────────────────────────────────────────────
    const fetchConversations = useCallback(async () => {
        if (!token) return
        try {
            const res = await fetch(`${API_URL}/chat/conversations`, {
                headers: authHeaders(),
            })
            if (res.ok) {
                const data: Conversation[] = await res.json()
                setConversations(data)
            }
        } catch {
            // silent
        }
    }, [token, authHeaders])

    useEffect(() => { fetchConversations() }, [fetchConversations])

    // ── Sync activeOtherId from URL ────────────────────────────────────────
    useEffect(() => {
        if (otherIdFromUrl && otherIdFromUrl !== activeOtherId) {
            setActiveOtherId(otherIdFromUrl)
        }
    }, [otherIdFromUrl])

    // ── Load messages when conversation changes ────────────────────────────
    useEffect(() => {
        if (!activeOtherId || !token) return
        setMessages([])
        setIsLoadingMsgs(true)

        const rid = buildRoomId(myId, activeOtherId)
        fetch(`${API_URL}/chat/rooms/${rid}/messages`, { headers: authHeaders() })
            .then(async r => {
                if (!r.ok) throw new Error()
                return r.json() as Promise<ChatMessage[]>
            })
            .then(msgs => {
                setMessages(msgs)
                const conv = conversations.find(c => c.other_user_id === activeOtherId)
                if (conv) setActiveOtherName(conv.other_name)
            })
            .catch(() => { })
            .finally(() => setIsLoadingMsgs(false))
    }, [activeOtherId, token, myId])

    // Auto-resolve name from conversations list when it loads
    useEffect(() => {
        if (activeOtherId && !activeOtherName) {
            const conv = conversations.find(c => c.other_user_id === activeOtherId)
            if (conv) setActiveOtherName(conv.other_name)
        }
    }, [conversations, activeOtherId, activeOtherName])

    // ── Send text message ──────────────────────────────────────────────────
    const sendText = async () => {
        const body = input.trim()
        if (!body || !currentRoomId) return
        setInput('')
        setIsSending(true)
        try {
            const res = await fetch(`${API_URL}/chat/rooms/${currentRoomId}/messages`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ body }),
            })
            if (!res.ok) throw new Error(await res.text())
            const msg: ChatMessage = await res.json()
            setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
            fetchConversations()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to send')
            setInput(body) // restore on failure
        } finally {
            setIsSending(false)
        }
    }

    // ── Send image ─────────────────────────────────────────────────────────
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !currentRoomId) return
        e.target.value = ''

        if (!file.type.startsWith('image/')) {
            toast.error('Only image files are supported')
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be under 5 MB')
            return
        }

        setIsUploadingImage(true)
        try {
            // 1. Upload the file
            const formData = new FormData()
            formData.append('image', file)
            const uploadRes = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formData,
            })
            if (!uploadRes.ok) throw new Error('Upload failed')
            const { url } = await uploadRes.json()

            // 2. Send the image URL as a message
            const msgRes = await fetch(`${API_URL}/chat/rooms/${currentRoomId}/messages`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ image_url: url }),
            })
            if (!msgRes.ok) throw new Error(await msgRes.text())
            const msg: ChatMessage = await msgRes.json()
            setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
            fetchConversations()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to send image')
        } finally {
            setIsUploadingImage(false)
        }
    }

    // ── Switch conversation ────────────────────────────────────────────────
    const selectConversation = (conv: Conversation) => {
        setActiveOtherId(conv.other_user_id)
        setActiveOtherName(conv.other_name)
        navigate(`/chat/${conv.other_user_id}`, { replace: true })
    }

    const lastPreview = (c: Conversation) => {
        if (c.last_image_url) return '📷 Image'
        if (c.last_body) return c.last_body.length > 40 ? c.last_body.slice(0, 40) + '…' : c.last_body
        return ''
    }

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <Navbar />

            {lightboxSrc && (
                <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
            )}

            <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex bg-white rounded-2xl border border-gray-100 shadow-sm h-[calc(100vh-136px)] overflow-hidden">

                    {/* ── Sidebar: Conversation List ──────────────────────── */}
                    <div className="w-72 border-r border-gray-100 flex flex-col flex-shrink-0">
                        <div className="p-4 border-b border-gray-100">
                            <h2 className="font-bold text-gray-900 text-lg">Messages</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {conversations.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 px-4 text-center">
                                    <MessageSquare size={36} className="opacity-20" />
                                    <p className="text-sm">No conversations yet.<br />Message a seller from any listing page.</p>
                                </div>
                            ) : (
                                conversations.map((conv) => {
                                    const isActive = conv.other_user_id === activeOtherId
                                    return (
                                        <button
                                            key={conv.room_id}
                                            onClick={() => selectConversation(conv)}
                                            className={`w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-start gap-3 border-b border-gray-50 ${isActive ? 'bg-orange-50 border-l-2 border-l-orange-500' : ''}`}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-bold text-white flex-shrink-0 text-sm">
                                                {conv.other_name[0]}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-1">
                                                    <p className={`font-semibold text-sm truncate ${isActive ? 'text-orange-700' : 'text-gray-900'}`}>
                                                        {conv.other_name}
                                                    </p>
                                                    <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(conv.last_at)}</span>
                                                </div>
                                                <p className="text-xs text-gray-400 truncate mt-0.5">{lastPreview(conv)}</p>
                                            </div>
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* ── Chat Window ─────────────────────────────────────── */}
                    {!activeOtherId ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
                            <MessageSquare size={48} className="opacity-10" />
                            <p className="font-medium">Select a conversation to start chatting</p>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col min-w-0">
                            {/* Header */}
                            <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => navigate(-1)}
                                        className="sm:hidden text-gray-400 hover:text-gray-600 mr-1"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-bold text-white text-sm">
                                        {activeOtherName ? activeOtherName[0] : '?'}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900 text-sm">{activeOtherName || 'Loading…'}</p>
                                        <span className={`flex items-center gap-1 text-xs ${isConnected ? 'text-green-500' : 'text-gray-400'}`}>
                                            {isConnected
                                                ? <><Wifi size={10} /> Connected</>
                                                : <><WifiOff size={10} /> Reconnecting…</>
                                            }
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-3">
                                {isLoadingMsgs ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 size={28} className="animate-spin text-orange-400" />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
                                        <MessageSquare size={32} className="opacity-20" />
                                        <p className="text-sm">No messages yet. Say hello! 👋</p>
                                    </div>
                                ) : (
                                    messages.map((msg) => (
                                        <MessageBubble
                                            key={msg.id}
                                            msg={msg}
                                            isMe={msg.sender_id === myId}
                                            onImageClick={setLightboxSrc}
                                        />
                                    ))
                                )}
                                {isUploadingImage && (
                                    <div className="flex justify-end">
                                        <div className="bg-gray-100 rounded-2xl rounded-br-sm px-4 py-3 flex items-center gap-2 text-sm text-gray-400">
                                            <Loader2 size={14} className="animate-spin" /> Uploading image…
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input bar */}
                            <div className="p-3 border-t border-gray-100 flex-shrink-0">
                                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                                    {/* Image picker */}
                                    <button
                                        className="text-gray-400 hover:text-orange-500 transition-colors p-1 flex-shrink-0"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploadingImage}
                                        title="Send image"
                                    >
                                        {isUploadingImage ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleFileSelect}
                                    />

                                    {/* Text input */}
                                    <input
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                sendText()
                                            }
                                        }}
                                        placeholder="Type a message…"
                                        className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400 py-1"
                                        disabled={isSending}
                                    />

                                    {/* Send button */}
                                    <button
                                        onClick={sendText}
                                        disabled={!input.trim() || isSending}
                                        className="w-8 h-8 bg-orange-500 disabled:bg-gray-200 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
                                    >
                                        {isSending
                                            ? <Loader2 size={14} className="animate-spin text-white" />
                                            : <Send size={14} className={input.trim() ? 'text-white' : 'text-gray-400'} />
                                        }
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 text-center mt-1.5">
                                    Enter to send · 📷 to share an image
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
