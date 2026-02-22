import { Link } from 'react-router-dom'
import { ShoppingBag, ArrowRight, Zap, Shield, MessageCircle, Award } from 'lucide-react'
import Navbar from '../components/Navbar'

const FEATURED = [
    { id: '1', title: 'Vintage Bicycle', price: 8500, type: 'AUCTION', image: 'https://images.unsplash.com/photo-1508789454646-bef72439f197?w=400&q=80', location: 'Dharampeth' },
    { id: '2', title: 'Leather Sofa', price: 22000, type: 'FIXED', image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80', location: 'Civil Lines' },
    { id: '3', title: 'Gaming Laptop', price: 55000, type: 'AUCTION', image: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&q=80', location: 'Sadar' },
    { id: '4', title: 'Antique Vase', price: 3200, type: 'AUCTION', image: 'https://images.unsplash.com/photo-1577083552792-a0d461cb1dd6?w=400&q=80', location: 'Sitabuldi' },
]

const HOW_IT_WORKS = [
    { icon: ShoppingBag, title: 'List Your Items', desc: 'Post in seconds — fixed price or start an auction' },
    { icon: Zap, title: 'Bid or Buy Now', desc: 'Compete in live auctions or grab fixed-price deals instantly' },
    { icon: MessageCircle, title: 'Chat Directly', desc: 'Message sellers and buyers right on the platform' },
    { icon: Award, title: 'Secure Wallet', desc: 'UPI-powered digital wallet keeps transactions safe' },
]

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            {/* Hero */}
            <section className="relative overflow-hidden bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/3" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full translate-y-1/2 -translate-x-1/4" />
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 relative z-10">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white text-sm font-medium px-4 py-2 rounded-full mb-6">
                            <Shield size={14} /> Nagpur's #1 Peer-to-Peer Marketplace
                        </div>
                        <h1 className="text-5xl font-bold leading-tight mb-6">
                            Find What You Need,<br />
                            <span className="text-orange-200">Sell What You Don't</span>
                        </h1>
                        <p className="text-xl text-orange-100 mb-8">
                            Buy, sell, auction items across Nagpur. Chat directly with buyers and sellers. All free, all local.
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <Link to="/dashboard" className="bg-white text-orange-600 hover:bg-orange-50 font-bold px-7 py-3.5 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center gap-2">
                                Browse Listings <ArrowRight size={18} />
                            </Link>
                            <Link to="/listings/new" className="bg-orange-700 hover:bg-orange-800 text-white font-bold px-7 py-3.5 rounded-xl transition-all flex items-center gap-2">
                                Start Selling
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* How it Works */}
            <section className="py-20 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="section-title text-center mb-3">How It Works</h2>
                    <p className="text-gray-500 text-center mb-12">Buy + Sell + Auction + Chat</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        {HOW_IT_WORKS.map(({ icon: Icon, title, desc }) => (
                            <div key={title} className="text-center group">
                                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-orange-500 transition-colors duration-300">
                                    <Icon size={28} className="text-orange-500 group-hover:text-white transition-colors duration-300" />
                                </div>
                                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                                <p className="text-sm text-gray-500">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Featured Listings */}
            <section className="py-16 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="section-title">Featured Listings</h2>
                        <Link to="/dashboard" className="text-orange-600 hover:text-orange-700 font-semibold text-sm flex items-center gap-1">
                            View all <ArrowRight size={16} />
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {FEATURED.map((item) => (
                            <Link key={item.id} to={`/auctions/${item.id}`} className="card group overflow-hidden block">
                                <div className="relative overflow-hidden">
                                    <img src={item.image} alt={item.title} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300" />
                                    <div className="absolute top-3 left-3">
                                        {item.type === 'AUCTION'
                                            ? <span className="badge-auction">🔨 Auction</span>
                                            : <span className="badge-fixed">✓ Fixed</span>
                                        }
                                    </div>
                                </div>
                                <div className="p-4">
                                    <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                                    <p className="text-xs text-gray-400 mb-2">📍 {item.location}</p>
                                    <p className="price-tag">₹{item.price.toLocaleString('en-IN')}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Banner */}
            <section className="py-20 bg-orange-500 text-white text-center">
                <div className="max-w-2xl mx-auto px-4">
                    <h2 className="text-3xl font-bold mb-4">Don't miss the best deals in town!</h2>
                    <p className="text-orange-100 mb-8">Join thousands of buyers and sellers across Nagpur.</p>
                    <Link to="/dashboard" className="bg-white text-orange-600 font-bold px-8 py-3.5 rounded-xl hover:bg-orange-50 transition-all shadow-lg inline-flex items-center gap-2">
                        Start Browsing <ArrowRight size={18} />
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-400 py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                                    <ShoppingBag size={16} className="text-white" />
                                </div>
                                <span className="text-white font-bold">Orange City Mart</span>
                            </div>
                            <p className="text-sm">Nagpur's trusted P2P marketplace</p>
                        </div>
                        <div>
                            <p className="text-white font-semibold mb-3">Shop</p>
                            <ul className="space-y-2 text-sm">
                                <li><Link to="/dashboard" className="hover:text-orange-400 transition-colors">All Listings</Link></li>
                                <li><Link to="/dashboard" className="hover:text-orange-400 transition-colors">Auctions</Link></li>
                                <li><Link to="/search" className="hover:text-orange-400 transition-colors">Search</Link></li>
                            </ul>
                        </div>
                        <div>
                            <p className="text-white font-semibold mb-3">Support</p>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-orange-400 transition-colors">Help Center</a></li>
                                <li><a href="#" className="hover:text-orange-400 transition-colors">Contact Us</a></li>
                            </ul>
                        </div>
                        <div>
                            <p className="text-white font-semibold mb-3">Company</p>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-orange-400 transition-colors">Privacy Policy</a></li>
                                <li><a href="#" className="hover:text-orange-400 transition-colors">Terms of Service</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-gray-800 pt-8 text-center text-sm">
                        <p>© {new Date().getFullYear()} Orange City Mart. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    )
}
