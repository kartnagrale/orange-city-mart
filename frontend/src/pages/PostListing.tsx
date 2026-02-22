import { useState } from 'react'
import { Upload, X, Tag, MapPin, Camera } from 'lucide-react'
import Navbar from '../components/Navbar'
import toast from 'react-hot-toast'

const CATEGORIES = ['Electronics', 'Furniture', 'Fashion', 'Vehicles', 'Properties', 'Sports', 'Books', 'Other']

export default function PostListing() {
    const [listingType, setListingType] = useState<'FIXED' | 'AUCTION'>('FIXED')
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [category, setCategory] = useState('')
    const [price, setPrice] = useState('')
    const [startPrice, setStartPrice] = useState('')
    const [endDate, setEndDate] = useState('')
    const [location, setLocation] = useState('')
    const [images, setImages] = useState<string[]>([])

    const handleImageDrop = (e: React.DragEvent) => {
        e.preventDefault()
        // In production, upload to storage and get URL
        toast('Image upload will be handled by backend storage')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title || !category || !location) {
            toast.error('Please fill in all required fields')
            return
        }
        toast.success('Listing submitted! (Connect backend to persist)')
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Post a New Listing</h1>
                    <p className="text-gray-500 mt-2">Reach thousands of buyers across Nagpur</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Listing Type */}
                    <div className="card p-6">
                        <h2 className="font-bold text-gray-900 mb-4">Listing Type</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {(['FIXED', 'AUCTION'] as const).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setListingType(t)}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${listingType === t
                                            ? 'border-orange-500 bg-orange-50'
                                            : 'border-gray-200 hover:border-orange-200'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${listingType === t ? 'border-orange-500' : 'border-gray-300'}`}>
                                            {listingType === t && <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900">{t === 'FIXED' ? '🏷️ Fixed Price' : '🔨 Auction'}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">{t === 'FIXED' ? 'Set your own price' : 'Let buyers compete'}</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Photos */}
                    <div className="card p-6">
                        <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Camera size={18} /> Photos</h2>
                        <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleImageDrop}
                            className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center hover:border-orange-300 transition-colors cursor-pointer"
                        >
                            <Upload size={32} className="mx-auto text-gray-300 mb-3" />
                            <p className="text-sm text-gray-500">Drag & drop photos here, or <span className="text-orange-500 font-medium">browse</span></p>
                            <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 10MB each. First photo is the cover.</p>
                        </div>
                        {images.length > 0 && (
                            <div className="flex flex-wrap gap-3 mt-4">
                                {images.map((img, i) => (
                                    <div key={i} className="relative">
                                        <img src={img} className="w-20 h-20 object-cover rounded-lg" alt="" />
                                        <button onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5">
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Basic Info */}
                    <div className="card p-6 space-y-5">
                        <h2 className="font-bold text-gray-900">Item Details</h2>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
                            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="e.g. Sony WH-1000XM5 Headphones" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category *</label>
                            <div className="relative">
                                <Tag size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <select value={category} onChange={(e) => setCategory(e.target.value)} className="input pl-9" required>
                                    <option value="">Select a category</option>
                                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                className="input resize-none"
                                placeholder="Describe your item's condition, features, reason for selling..."
                            />
                        </div>
                    </div>

                    {/* Pricing */}
                    <div className="card p-6 space-y-5">
                        <h2 className="font-bold text-gray-900">Pricing</h2>
                        {listingType === 'FIXED' ? (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Price (₹) *</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-500">₹</span>
                                    <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="input pl-8" placeholder="0" min="1" required />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Starting Price (₹) *</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-500">₹</span>
                                        <input type="number" value={startPrice} onChange={(e) => setStartPrice(e.target.value)} className="input pl-8" placeholder="0" min="1" required />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Auction End Date *</label>
                                    <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" required />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Location */}
                    <div className="card p-6">
                        <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><MapPin size={18} /> Location</h2>
                        <input value={location} onChange={(e) => setLocation(e.target.value)} className="input" placeholder="e.g. Dharampeth, Nagpur" required />
                    </div>

                    {/* Submit */}
                    <div className="flex gap-4">
                        <button type="submit" className="btn-primary flex-1 py-3.5 text-base">
                            🚀 Post Listing
                        </button>
                        <button type="button" className="btn-outline px-6 py-3.5">
                            Save Draft
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
