import { useRef, useState } from 'react'
import { Upload, X, Tag, MapPin, Camera, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

const CATEGORIES = ['Electronics', 'Furniture', 'Fashion', 'Vehicles', 'Properties', 'Sports', 'Books', 'Other']
// Use empty string so all fetch calls use relative URLs → proxied by Vite to the backend
import { API_URL as API } from '../config'

export default function PostListing() {
    const navigate = useNavigate()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { token } = useAuth()

    const [listingType, setListingType] = useState<'FIXED' | 'AUCTION'>('FIXED')
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [category, setCategory] = useState('')
    const [price, setPrice] = useState('')
    const [startPrice, setStartPrice] = useState('')
    const [endDate, setEndDate] = useState('')
    const [location, setLocation] = useState('')

    // Image state
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // ── Upload handler ────────────────────────────────────────────────────────
    const uploadFile = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file (JPEG, PNG, WEBP)')
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be under 5 MB')
            return
        }

        // Show local preview immediately
        setImagePreview(URL.createObjectURL(file))
        setUploading(true)

        try {
            const form = new FormData()
            form.append('image', file)

            const res = await fetch(`${API}/api/upload`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: form,
            })
            if (!res.ok) throw new Error(await res.text())
            const data = await res.json()
            setImageUrl(data.url)
            toast.success('Photo uploaded!')
        } catch (err: any) {
            toast.error('Upload failed: ' + err.message)
            setImagePreview(null)
        } finally {
            setUploading(false)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) uploadFile(file)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        const file = e.dataTransfer.files?.[0]
        if (file) uploadFile(file)
    }

    const removeImage = () => {
        setImageUrl(null)
        setImagePreview(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title || !category || !location) {
            toast.error('Please fill in all required fields')
            return
        }

        setSubmitting(true)
        try {
            const payload: Record<string, any> = {
                title,
                description,
                category,
                type: listingType,
                location,
                image_url: imageUrl ?? '',
            }

            if (listingType === 'FIXED') {
                payload.price = parseFloat(price)
            } else {
                payload.start_price = parseFloat(startPrice)
                payload.end_time = new Date(endDate).toISOString()
            }

            const res = await fetch(`${API}/api/products`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            })

            if (!res.ok) throw new Error(await res.text())

            toast.success('🎉 Listing posted!')
            navigate('/dashboard')
        } catch (err: any) {
            toast.error('Failed to post listing: ' + err.message)
        } finally {
            setSubmitting(false)
        }
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

                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={handleFileChange}
                        />

                        {!imagePreview ? (
                            <div
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center hover:border-orange-300 transition-colors cursor-pointer"
                            >
                                {uploading ? (
                                    <Loader2 size={32} className="mx-auto text-orange-400 mb-3 animate-spin" />
                                ) : (
                                    <Upload size={32} className="mx-auto text-gray-300 mb-3" />
                                )}
                                <p className="text-sm text-gray-500">
                                    Drag & drop a photo here, or{' '}
                                    <span className="text-orange-500 font-medium">browse</span>
                                </p>
                                <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WEBP — max 5 MB</p>
                            </div>
                        ) : (
                            <div className="relative w-fit mt-2">
                                <img
                                    src={imagePreview}
                                    alt="Preview"
                                    className="w-40 h-40 object-cover rounded-xl border border-gray-200 shadow-sm"
                                />
                                {uploading && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
                                        <Loader2 size={24} className="text-orange-500 animate-spin" />
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={removeImage}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                                {imageUrl && (
                                    <span className="absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                                        ✓ Uploaded
                                    </span>
                                )}
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
                        <button
                            type="submit"
                            disabled={submitting || uploading}
                            className="btn-primary flex-1 py-3.5 text-base disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {submitting ? <><Loader2 size={18} className="animate-spin" /> Posting...</> : '🚀 Post Listing'}
                        </button>
                        <button type="button" onClick={() => navigate(-1)} className="btn-outline px-6 py-3.5">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
