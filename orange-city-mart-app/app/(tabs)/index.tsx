import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../lib/config';
import { Flame, Clock, MapPin, Tag } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function Dashboard() {
  const router = useRouter();
  const { user, token } = useAuth();
  
  const [auctions, setAuctions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      if (!token) return;
      
      const res = await fetch(`${API_URL}/products`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });

      if (res.ok) {
        const data = await res.json() || [];
        setAuctions(data.filter((p: any) => p.type === 'AUCTION'));
        setProducts(data.filter((p: any) => p.type === 'FIXED'));
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Blurred Sticky Header */}
      <View className="absolute top-0 left-0 right-0 z-50 pt-12 pb-4 px-6 bg-white/70" style={{ overflow: 'hidden' }}>
        <BlurView intensity={80} tint="light" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-gray-500 font-bold text-xs uppercase tracking-widest">Welcome back</Text>
            <Text className="text-2xl font-black text-gray-900">{user?.name || 'Explorer'}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/wallet')}>
            <View className="w-12 h-12 bg-white rounded-full items-center justify-center shadow-sm border border-orange-100">
               <Text className="text-xl">💰</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: 110, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        
        {/* Live Auctions Carousel */}
        {auctions.length > 0 && (
          <View className="mb-10">
            <View className="px-6 flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <Flame color="#ea580c" size={24} strokeWidth={2.5} />
                <Text className="text-2xl font-black text-gray-900 ml-2">Live Auctions</Text>
              </View>
              <Text className="text-orange-600 font-bold">See all</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
              {auctions.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  activeOpacity={0.9}
                  onPress={() => router.push(`/auctions/${a.id}`)}
                  style={{ width: width * 0.75 }}
                  className="mr-5 bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100"
                >
                  <View className="relative h-48">
                    <Image source={{ uri: a.image_url ? (a.image_url.startsWith('http') ? a.image_url : `${API_URL.replace('/api', '')}${a.image_url}`) : 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc' }} className="w-full h-full" />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} className="absolute bottom-0 left-0 right-0 h-24" />
                    
                    <View className="absolute top-4 left-4 bg-orange-500/90 px-3 py-1.5 rounded-full flex-row items-center">
                      <Clock color="#fff" size={14} />
                      <Text className="text-white text-xs font-bold ml-1">Live Now</Text>
                    </View>

                    <Text className="absolute bottom-4 left-4 right-4 text-white font-black text-xl" numberOfLines={1}>{a.title}</Text>
                  </View>

                  <View className="p-5 flex-row items-center justify-between">
                    <View>
                      <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Current Bid</Text>
                      <Text className="text-orange-600 font-black text-2xl">₹{a.current_bid?.toLocaleString() || a.start_price?.toLocaleString()}</Text>
                    </View>
                    <View className="bg-orange-50 w-12 h-12 rounded-full items-center justify-center">
                      <Tag color="#ea580c" size={20} />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Fresh Finds Grid */}
        <View className="px-6 mb-8">
          <Text className="text-2xl font-black text-gray-900 mb-6">Fresh Finds</Text>
          
          <View className="flex-row flex-wrap justify-between">
            {products.map((p) => (
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.8}
                onPress={() => router.push(`/listings/${p.id}`)}
                className="w-[48%] bg-white rounded-[24px] mb-4 shadow-sm border border-gray-100 overflow-hidden pb-4"
              >
                <Image source={{ uri: p.image_url ? (p.image_url.startsWith('http') ? p.image_url : `${API_URL.replace('/api', '')}${p.image_url}`) : 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc' }} className="w-full h-40 rounded-t-[24px]" />
                <View className="px-3 pt-3">
                  <Text className="text-gray-900 font-bold text-base mb-1" numberOfLines={1}>{p.title}</Text>
                  <Text className="text-xs text-gray-500 flex-row items-center" numberOfLines={1}>📍 {p.location || 'Nagpur'}</Text>
                  <Text className="text-orange-600 font-black text-lg mt-2">₹{p.price?.toLocaleString() || p.start_price?.toLocaleString()}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          
          {loading && <ActivityIndicator size="large" color="#ea580c" className="my-10" />}
          {!loading && products.length === 0 && auctions.length === 0 && (
            <View className="items-center justify-center py-20">
              <Text className="text-gray-400 text-lg font-bold">No active listings nearby.</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}
