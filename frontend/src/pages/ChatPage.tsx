import { useState, useRef, useEffect } from 'react'
import { Send, Image, MoreVertical, CheckCheck, Info } from 'lucide-react'
import Navbar from '../components/Navbar'

const CONVERSATIONS = [
    { id: '1', user: 'John Doe', avatar: 'J', lastMsg: 'Is the lens scratch-free?', time: '2m ago', unread: 1, item: 'Vintage Camera' },
    { id: '2', user: 'Sarah Smith', avatar: 'S', lastMsg: 'I can pick it up today if that works.', time: '1h ago', unread: 0, item: 'Leather Sofa' },
    { id: '3', user: 'Mike Ross', avatar: 'M', lastMsg: 'Is this still available?', time: '2h ago', unread: 0, item: 'MacBook Pro' },
]

const INITIAL_MESSAGES = [
    { id: 1, from: 'them', text: "Hi! I'm interested in the Vintage Camera. Is the price negotiable?" },
    { id: 2, from: 'me', text: 'Hello! Since this is an auction, please place your bid on the listing page. The current bid is ₹12,000.' },
    { id: 3, from: 'them', text: 'Understood. Is the lens scratch-free? Can you send a close-up?' },
    { id: 4, from: 'me', text: "Yes, it's pristine. Let me send a close up photo." },
]

export default function ChatPage() {
    const [activeConv, setActiveConv] = useState(CONVERSATIONS[0])
    const [messages, setMessages] = useState(INITIAL_MESSAGES)
    const [input, setInput] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const send = () => {
        if (!input.trim()) return
        setMessages((prev) => [...prev, { id: Date.now(), from: 'me', text: input.trim() }])
        setInput('')
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 h-[calc(100vh-80px)]">
                <div className="flex bg-white rounded-2xl border border-gray-100 shadow-sm h-full overflow-hidden">
                    {/* Conversation list */}
                    <div className="w-80 border-r border-gray-100 flex flex-col">
                        <div className="p-4 border-b border-gray-100">
                            <h2 className="font-bold text-gray-900 text-lg">Messages</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {CONVERSATIONS.map((conv) => (
                                <button
                                    key={conv.id}
                                    onClick={() => setActiveConv(conv)}
                                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-start gap-3 border-b border-gray-50 ${activeConv.id === conv.id ? 'bg-orange-50' : ''}`}
                                >
                                    <div className="w-11 h-11 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-600 flex-shrink-0">
                                        {conv.avatar}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <p className="font-semibold text-gray-900 text-sm">{conv.user}</p>
                                            <span className="text-xs text-gray-400">{conv.time}</span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5 truncate">{conv.lastMsg}</p>
                                    </div>
                                    {conv.unread > 0 && (
                                        <span className="w-5 h-5 bg-orange-500 rounded-full text-white text-xs flex items-center justify-center flex-shrink-0">
                                            {conv.unread}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Chat window */}
                    <div className="flex-1 flex flex-col">
                        {/* Header */}
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-600">
                                    {activeConv.avatar}
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">{activeConv.user}</p>
                                    <p className="text-xs text-orange-500">Re: {activeConv.item}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="btn-ghost p-2"><Info size={18} /></button>
                                <button className="btn-ghost p-2"><MoreVertical size={18} /></button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                                    {msg.from === 'them' && (
                                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-600 text-sm mr-2 flex-shrink-0 self-end mb-1">
                                            {activeConv.avatar}
                                        </div>
                                    )}
                                    <div className={`max-w-sm px-4 py-3 rounded-2xl text-sm ${msg.from === 'me'
                                            ? 'bg-orange-500 text-white rounded-br-sm'
                                            : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                                        }`}>
                                        <p>{msg.text}</p>
                                        {msg.from === 'me' && (
                                            <div className="flex justify-end mt-1">
                                                <CheckCheck size={12} className="text-orange-200" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-gray-100">
                            <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2">
                                <button className="text-gray-400 hover:text-orange-500 transition-colors">
                                    <Image size={20} />
                                </button>
                                <input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
                                    }}
                                    placeholder="Press Enter to send. Shift + Enter for new line."
                                    className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
                                />
                                <button
                                    onClick={send}
                                    disabled={!input.trim()}
                                    className="w-9 h-9 bg-orange-500 disabled:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
                                >
                                    <Send size={16} className={input.trim() ? 'text-white' : 'text-gray-400'} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
