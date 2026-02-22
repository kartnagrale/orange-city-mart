import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Wallet, ArrowDownCircle, ArrowUpCircle, TrendingUp, Clock, ChevronRight, Loader2 } from 'lucide-react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'

interface Transaction {
    id: string
    amount: number
    type: 'DEPOSIT' | 'WITHDRAW' | 'BID_HOLD' | 'REFUND'
    status: string
    reference: string | null
    created_at: string
}

const typeConfig: Record<string, { icon: ReactNode; color: string; bg: string; label: string }> = {
    DEPOSIT: { icon: <ArrowDownCircle size={18} />, color: 'text-green-600', bg: 'bg-green-50', label: 'Deposit' },
    WITHDRAW: { icon: <ArrowUpCircle size={18} />, color: 'text-red-500', bg: 'bg-red-50', label: 'Withdrawal' },
    BID_HOLD: { icon: <Clock size={18} />, color: 'text-orange-500', bg: 'bg-orange-50', label: 'Bid Hold' },
    REFUND: { icon: <TrendingUp size={18} />, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Refund' },
}

function fmt(d: string) {
    return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function WalletPage() {
    const { token, user } = useAuth()
    const [balance, setBalance] = useState(user?.wallet_balance ?? 0)
    const [txns, setTxns] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [modal, setModal] = useState<'deposit' | 'withdraw' | null>(null)
    const [amount, setAmount] = useState('')
    const [working, setWorking] = useState(false)
    const [error, setError] = useState('')

    const fetchWallet = () => {
        if (!token) return
        fetch('/api/wallet', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(d => { setBalance(d.balance); setTxns(d.transactions ?? []) })
            .catch(console.error)
            .finally(() => setLoading(false))
    }

    useEffect(() => { fetchWallet() }, [token])

    const handleAction = async () => {
        const val = parseFloat(amount)
        if (isNaN(val) || val <= 0) { setError('Enter a valid amount'); return }
        if (modal === 'withdraw' && val > balance) { setError('Insufficient balance'); return }
        setWorking(true); setError('')

        const url = modal === 'deposit' ? '/api/wallet/deposit' : '/api/wallet/withdraw'
        const body = modal === 'deposit'
            ? { amount: val, upi_ref: `UPI${Date.now()}` }
            : { amount: val, upi_id: user?.email ?? 'user@upi' }

        try {
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body),
            })
            if (!r.ok) throw new Error(await r.text())
            setModal(null); setAmount('')
            fetchWallet()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setWorking(false)
        }
    }

    const totalIn = txns.filter(t => t.type === 'DEPOSIT' || t.type === 'REFUND').reduce((s, t) => s + t.amount, 0)
    const totalOut = txns.filter(t => t.type === 'WITHDRAW').reduce((s, t) => s + t.amount, 0)
    const holds = txns.filter(t => t.type === 'BID_HOLD').reduce((s, t) => s + t.amount, 0)

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Balance card */}
                <div className="card p-8 mb-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                    <div className="flex items-center gap-3 mb-1">
                        <Wallet size={22} />
                        <p className="font-medium text-orange-100">My Wallet</p>
                    </div>
                    {loading
                        ? <div className="h-12 flex items-center"><Loader2 size={28} className="animate-spin opacity-70" /></div>
                        : <p className="text-5xl font-bold mb-1">₹{balance.toLocaleString('en-IN')}</p>
                    }
                    <p className="text-orange-200 text-sm">Available Balance</p>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => { setModal('deposit'); setError('') }} className="flex-1 bg-white text-orange-600 font-bold py-3 rounded-xl hover:bg-orange-50 transition-all flex items-center justify-center gap-2">
                            <ArrowDownCircle size={18} /> Add Money
                        </button>
                        <button onClick={() => { setModal('withdraw'); setError('') }} className="flex-1 bg-orange-700 hover:bg-orange-800 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                            <ArrowUpCircle size={18} /> Withdraw
                        </button>
                    </div>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    {[
                        { label: 'Total In', value: `₹${totalIn.toLocaleString('en-IN')}`, icon: ArrowDownCircle, color: 'text-green-500' },
                        { label: 'Total Out', value: `₹${totalOut.toLocaleString('en-IN')}`, icon: ArrowUpCircle, color: 'text-red-400' },
                        { label: 'Active Holds', value: `₹${holds.toLocaleString('en-IN')}`, icon: Clock, color: 'text-orange-500' },
                    ].map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className="card p-4 text-center">
                            <Icon size={20} className={`${color} mx-auto mb-1`} />
                            <p className="text-xl font-bold text-gray-900">{loading ? '…' : value}</p>
                            <p className="text-xs text-gray-400">{label}</p>
                        </div>
                    ))}
                </div>

                {/* Transaction history */}
                <div className="card p-6">
                    <h2 className="font-bold text-gray-900 text-lg mb-5">Transaction History</h2>
                    {loading ? (
                        <div className="flex justify-center py-8 text-gray-400"><Loader2 size={28} className="animate-spin" /></div>
                    ) : txns.length === 0 ? (
                        <p className="text-center text-gray-400 py-8">No transactions yet</p>
                    ) : (
                        <div className="space-y-1">
                            {txns.map((tx) => {
                                const cfg = typeConfig[tx.type]
                                const isCredit = tx.type === 'DEPOSIT' || tx.type === 'REFUND'
                                return (
                                    <div key={tx.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group">
                                        <div className={`w-10 h-10 rounded-full ${cfg.bg} ${cfg.color} flex items-center justify-center flex-shrink-0`}>
                                            {cfg.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 truncate">{cfg.label}{tx.reference ? ` · ${tx.reference}` : ''}</p>
                                            <p className="text-xs text-gray-400">{fmt(tx.created_at)}</p>
                                        </div>
                                        <div className="text-right flex items-center gap-2">
                                            <p className={`font-bold ${isCredit ? 'text-green-600' : 'text-gray-900'}`}>
                                                {isCredit ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                                            </p>
                                            <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500" />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {modal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold text-gray-900 mb-1">{modal === 'deposit' ? 'Add Money' : 'Withdraw Money'}</h2>
                        <p className="text-sm text-gray-400 mb-5">{modal === 'deposit' ? 'Enter amount to add via UPI' : `Available: ₹${balance.toLocaleString('en-IN')}`}</p>
                        <div className="relative mb-4">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-500 text-lg">₹</span>
                            <input autoFocus type="number" value={amount} onChange={e => setAmount(e.target.value)} className="input pl-9 text-2xl font-bold" placeholder="0" min="1" />
                        </div>
                        <div className="flex gap-3 mb-4">
                            {[100, 500, 1000, 5000].map(v => (
                                <button key={v} onClick={() => setAmount(String(v))} className="flex-1 bg-gray-100 hover:bg-orange-100 text-gray-700 text-sm font-medium py-2 rounded-lg transition-colors">₹{v}</button>
                            ))}
                        </div>
                        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
                        <button onClick={handleAction} disabled={working} className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-60">
                            {working ? <Loader2 size={18} className="animate-spin" /> : (modal === 'deposit' ? '💳 Pay via UPI' : '🏦 Initiate Withdrawal')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
