import { ScrollView, View, Text, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, ArrowRight, ShoppingBag, Zap, MessageCircle, Award } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

const FEATURED = [
  { id: '1', title: 'Vintage Bicycle', price: 8500, type: 'AUCTION', image: 'https://images.unsplash.com/photo-1508789454646-bef72439f197?w=400&q=80', location: 'Dharampeth' },
  { id: '2', title: 'Leather Sofa', price: 22000, type: 'FIXED', image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80', location: 'Civil Lines' },
  { id: '3', title: 'Gaming Laptop', price: 55000, type: 'AUCTION', image: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&q=80', location: 'Sadar' },
  { id: '4', title: 'Antique Vase', price: 3200, type: 'AUCTION', image: 'https://images.unsplash.com/photo-1577083552792-a0d461cb1dd6?w=400&q=80', location: 'Sitabuldi' },
];

const HOW_IT_WORKS = [
  { icon: ShoppingBag, title: 'List Your Items', desc: 'Post in seconds — fixed price or start an auction' },
  { icon: Zap, title: 'Bid or Buy Now', desc: 'Compete in live auctions or grab fixed-price deals instantly' },
  { icon: MessageCircle, title: 'Chat Directly', desc: 'Message sellers and buyers right on the platform' },
  { icon: Award, title: 'Secure Wallet', desc: 'UPI-powered digital wallet keeps transactions safe' },
];

export default function LandingPage() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 60 }} bounces={false}>
        
        {/* Premium Hero Section */}
        <LinearGradient
          colors={['#ea580c', '#c2410c', '#9a3412']}
          className="pt-20 px-6 pb-16 items-center rounded-b-[40px] shadow-lg"
        >
          <View className="bg-white/20 px-4 py-2 rounded-full flex-row items-center mb-8 border border-white/30 shadow-sm">
            <Shield color="#ffffff" size={14} className="mr-2" />
            <Text className="text-white text-xs font-bold tracking-widest uppercase">Premium Marketplace</Text>
          </View>
          
          <Text className="text-5xl font-black text-white text-center leading-[55px] mb-4 shadow-sm">
            Find What{"\n"}You Need.
          </Text>
          <Text className="text-xl font-bold text-orange-200 text-center mb-10">
            Sell what you don't.
          </Text>
          
          <TouchableOpacity 
            onPress={() => router.push('/(tabs)')}
            className="w-full bg-white h-16 rounded-2xl shadow-xl flex-row items-center justify-between px-6 mb-4"
            activeOpacity={0.8}
          >
            <Text className="text-orange-900 font-extrabold text-lg">Enter Marketplace</Text>
            <View className="w-10 h-10 bg-orange-100 rounded-full items-center justify-center">
              <ArrowRight color="#ea580c" size={20} strokeWidth={3} />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => router.push('/(tabs)/add')}
            className="w-full bg-white/10 h-14 rounded-2xl border border-white/20 flex-row items-center justify-center"
            activeOpacity={0.8}
          >
            <Text className="text-white font-extrabold text-base">I want to sell an item</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* How It Works */}
        <View className="py-12 bg-white px-6">
          <Text className="text-2xl font-black text-center text-gray-900 mb-2">How It Works</Text>
          <Text className="text-gray-500 text-center mb-10 text-sm">Buy + Sell + Auction + Chat</Text>
          
          <View className="flex-row flex-wrap justify-between">
            {HOW_IT_WORKS.map((item, idx) => (
              <View key={idx} className="w-[48%] mb-6 items-center bg-gray-50 p-4 rounded-2xl">
                <View className="w-14 h-14 bg-orange-100 rounded-full items-center justify-center mb-3">
                  <item.icon color="#f97316" size={24} />
                </View>
                <Text className="font-bold text-gray-900 mb-1 text-center">{item.title}</Text>
                <Text className="text-xs text-center text-gray-500">{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Featured Listings */}
        <View className="py-10 bg-gray-50 px-6">
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-xl font-black text-gray-900">Featured Listings</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)')} className="flex-row items-center">
              <Text className="text-orange-600 font-bold text-sm mr-1">View all</Text>
              <ArrowRight color="#ea580c" size={16} />
            </TouchableOpacity>
          </View>
          
          {FEATURED.map((item) => (
            <TouchableOpacity 
              key={item.id}
              onPress={() => router.push(`/${item.type === 'AUCTION' ? 'auctions' : 'listings'}/${item.id}`)}
              className="bg-white rounded-2xl mb-4 overflow-hidden border border-gray-100 shadow-sm"
            >
              <View className="relative h-48">
                <Image source={{ uri: item.image }} className="w-full h-full" />
                <View className="absolute top-3 left-3 px-3 py-1 rounded-full bg-white/90">
                  <Text className="text-xs font-bold text-gray-800">
                    {item.type === 'AUCTION' ? '🔨 Auction' : '✓ Fixed'}
                  </Text>
                </View>
              </View>
              <View className="p-4">
                <Text className="text-lg font-bold text-gray-900">{item.title}</Text>
                <Text className="text-xs text-gray-500 my-1">📍 {item.location}</Text>
                <Text className="text-lg font-black text-orange-600 mt-2">₹{item.price.toLocaleString('en-IN')}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
