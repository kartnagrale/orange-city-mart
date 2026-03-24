import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../lib/config';
import { ArrowLeft, MessageCircle, ShieldCheck, MapPin } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { height } = Dimensions.get('window');

export default function ListingDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { token, user } = useAuth();
  
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const res = await fetch(`${API_URL}/products/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) setListing(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchListing();
  }, [id, token]);

  if (loading) return <View className="flex-1 justify-center items-center bg-white"><ActivityIndicator size="large" color="#ea580c" /></View>;
  if (!listing) return <View className="flex-1 justify-center items-center bg-white"><Text>Item not found</Text></View>;

  const isOwner = user?.id === listing.seller_id;

  return (
    <View className="flex-1 bg-white">
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} className="flex-1">
        
        {/* Hero Image */}
        <View className="relative w-full" style={{ height: height * 0.55 }}>
          <Image source={{ uri: listing.image_url || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc' }} className="w-full h-full" />
          <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent', 'transparent', 'rgba(0,0,0,0.8)']} className="absolute inset-0" />
          
          <TouchableOpacity onPress={() => router.back()} className="absolute top-14 left-6 z-50 w-12 h-12 rounded-full bg-white/20 items-center justify-center backdrop-blur-md">
            <ArrowLeft color="#fff" size={24} />
          </TouchableOpacity>
        </View>

        {/* Details Card */}
        <View className="bg-white -mt-10 rounded-t-[40px] px-6 pt-8 pb-32">
          
          <View className="flex-row items-center justify-between mb-4">
            <View className="bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
              <Text className="text-gray-900 font-bold text-xs uppercase tracking-widest">{listing.category || 'General'}</Text>
            </View>
            <View className="flex-row items-center">
              <MapPin color="#9ca3af" size={16} />
              <Text className="text-gray-500 font-bold ml-1 text-sm">{listing.location || 'Nagpur'}</Text>
            </View>
          </View>

          <Text className="text-3xl font-black text-gray-900 leading-tight mb-2">{listing.title}</Text>
          <Text className="text-orange-600 font-black text-3xl mb-8">₹{listing.price?.toLocaleString()}</Text>

          <View className="h-[1px] bg-gray-100 w-full mb-6" />

          <Text className="text-xl font-black text-gray-900 mb-3">About this item</Text>
          <Text className="text-gray-600 text-base leading-relaxed mb-8">{listing.description || 'No description provided.'}</Text>
          
          <Text className="text-xl font-black text-gray-900 mb-4">Seller Information</Text>
          <View className="bg-gray-50 rounded-3xl p-5 border border-gray-100 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-12 h-12 bg-gray-200 rounded-full items-center justify-center mr-3 border border-gray-300">
                <Text className="text-xl">👤</Text>
              </View>
              <View>
                <Text className="text-gray-900 font-bold text-lg">Local Member</Text>
                <Text className="text-green-600 font-bold text-xs flex-row items-center"><ShieldCheck color="#10b981" size={12} /> Verified Profile</Text>
              </View>
            </View>
          </View>

        </View>
      </ScrollView>

      {/* Floating Action Bar */}
      <View className="absolute bottom-0 left-0 right-0 p-6 pt-0 bg-white" style={{ elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.05, shadowRadius: 20 }}>
        {!isOwner ? (
          <TouchableOpacity 
            onPress={() => router.push(`/chat/new?product_id=${listing.id}&seller_id=${listing.seller_id}`)}
            className="w-full bg-gray-900 h-16 rounded-2xl flex-row items-center justify-center shadow-lg"
          >
            <MessageCircle color="#fff" size={24} className="mr-2" />
            <Text className="text-white font-black text-lg">Message Seller to Buy</Text>
          </TouchableOpacity>
        ) : (
          <View className="w-full bg-gray-100 h-16 rounded-2xl flex-row items-center justify-center border border-gray-200">
            <Text className="text-gray-500 font-black text-lg">This is your active listing</Text>
          </View>
        )}
      </View>
    </View>
  );
}
