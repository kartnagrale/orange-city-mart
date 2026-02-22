import { useParams } from 'react-router-dom'
import { MapPin, Heart, Share2, CheckCircle, ChevronRight } from 'lucide-react'
import Navbar from '../components/Navbar'
import BidPanel from '../components/BidPanel'

const MOCK_AUCTION = {
    id: 'a1',
    title: 'Vintage 1970s Leather Armchair - Restored',
    description: `A beautifully preserved mid-century modern armchair, originally manufactured in the 1970s. The piece features its original cognac leather upholstery, which has developed a rich, authentic patina over the decades. The frame is constructed from solid teak wood, known for its durability and warm grain patterns.\n\nProfessionally restored by our team in Nagpur. The restoration process involved cleaning and conditioning the leather, as well as refinishing the wood frame. The foam cushioning has been replaced with high-density foam.`,
    price: 18500,
    startPrice: 12000,
    location: 'Civil Lines, Nagpur',
    seller: 'Nagpur Vintage Goods',
    verified: true,
    endTime: new Date(Date.now() + 2 * 3600 * 1000 + 14 * 60 * 1000).toISOString(),
    specs: [
        { label: 'Dimensions', value: '32" H x 28" W x 30" D' },
        { label: 'Material', value: 'Genuine Leather, Teak Wood' },
        { label: 'Condition', value: 'Excellent (restored)' },
        { label: 'Origin', value: 'Private estate, Mumbai' },
    ],
    images: [
        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80',
        'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80',
    ],
    bids: [
        { user: 'User88***', time: '2 mins ago', amount: 18500 },
        { user: 'Rahul_K***', time: '5 mins ago', amount: 17000 },
        { user: 'Jasmin***', time: '12 mins ago', amount: 15500 },
        { user: 'Manish***', time: '25 mins ago', amount: 13000 },
    ],
}

const RELATED = [
    { title: 'Beige Minimalist Sofa', price: 12500, img: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=300&q=80' },
    { title: 'Teak Side Table', price: 2800, img: 'https://images.unsplash.com/photo-1530018352490-c6eef07fd7d5?w=300&q=80' },
    { title: 'Antique Brass Lamp', price: 1200, img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&q=80' },
    { title: 'Abstract Wall Art', price: 5000, img: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=300&q=80' },
]

// Demo user ID — in a real app this comes from auth context
const DEMO_USER_ID = 'buyer-demo-uuid'

export default function AuctionDetail() {
    const { id } = useParams()
    const auction = { ...MOCK_AUCTION, id: id || MOCK_AUCTION.id }

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            {/* Breadcrumb */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                <nav className="flex items-center gap-2 text-sm text-gray-400">
                    <a href="/" className="hover:text-orange-500">Home</a>
                    <ChevronRight size={14} />
                    <a href="/dashboard" className="hover:text-orange-500">Furniture</a>
                    <ChevronRight size={14} />
                    <span className="text-gray-700 truncate max-w-xs">{auction.title}</span>
                </nav>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Images + Details */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Image */}
                        <div className="card overflow-hidden relative group">
                            <img
                                src={auction.images[0]}
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
                            <div className="absolute bottom-4 left-4">
                                <span className="badge-auction text-sm">🔨 Live Auction</span>
                            </div>
                        </div>

                        {/* Thumbnail row */}
                        <div className="flex gap-3">
                            {auction.images.map((img, i) => (
                                <img key={i} src={img} alt="" className={`w-20 h-20 object-cover rounded-xl cursor-pointer border-2 ${i === 0 ? 'border-orange-500' : 'border-transparent'} hover:border-orange-300 transition-all`} />
                            ))}
                        </div>

                        {/* Title row */}
                        <div>
                            <div className="flex items-start justify-between gap-4">
                                <h1 className="text-2xl font-bold text-gray-900">{auction.title}</h1>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                                {auction.verified && (
                                    <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                                        <CheckCircle size={16} /> {auction.seller} verified
                                    </span>
                                )}
                                <span className="flex items-center gap-1 text-gray-400 text-sm">
                                    <MapPin size={14} /> {auction.location}
                                </span>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="card p-6">
                            <h2 className="font-bold text-gray-900 mb-3">Description</h2>
                            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{auction.description}</p>
                        </div>

                        {/* Specs */}
                        <div className="card p-6">
                            <h2 className="font-bold text-gray-900 mb-4">Item Specifics</h2>
                            <div className="grid grid-cols-2 gap-3">
                                {auction.specs.map((s) => (
                                    <div key={s.label} className="bg-gray-50 rounded-lg p-3">
                                        <p className="text-xs text-gray-400 font-medium">{s.label}</p>
                                        <p className="text-sm text-gray-900 font-semibold mt-0.5">{s.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Bid History */}
                        <div className="card p-6">
                            <h2 className="font-bold text-gray-900 mb-4">🕐 Bid History</h2>
                            <div className="space-y-3">
                                {auction.bids.map((b, i) => (
                                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">{b.user}</p>
                                            <p className="text-xs text-gray-400">{b.time}</p>
                                        </div>
                                        <p className="price-tag text-base">₹{b.amount.toLocaleString('en-IN')}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: BidPanel */}
                    <div className="space-y-4">
                        <BidPanel
                            auctionId={auction.id}
                            endTime={auction.endTime}
                            initialBid={auction.price}
                            startPrice={auction.startPrice}
                            userId={DEMO_USER_ID}
                        />

                        {/* Contact seller */}
                        <a href={`/chat/${auction.id}`} className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-600">
                                {auction.seller[0]}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-900">{auction.seller}</p>
                                <p className="text-xs text-orange-500">Message seller</p>
                            </div>
                        </a>
                    </div>
                </div>

                {/* Related items */}
                <div className="mt-12">
                    <h2 className="section-title mb-6">You Might Also Like</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {RELATED.map((item) => (
                            <div key={item.title} className="card overflow-hidden group cursor-pointer">
                                <img src={item.img} alt={item.title} className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300" />
                                <div className="p-3">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
                                    <p className="price-tag text-base mt-1">₹{item.price.toLocaleString('en-IN')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
