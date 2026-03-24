import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { API_URL, WS_URL } from '../../lib/config';
import { ArrowLeft, Clock, ShieldCheck, MapPin, Tag } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function AuctionDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { token, user } = useAuth();

  const [auction, setAuction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bidding, setBidding] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    fetchAuction();
  }, [id]);

  useEffect(() => {
    if (!token || !id) return;
    const socket = new WebSocket(`${WS_URL}/auctions/${id}/ws?token=${token}`);
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'NEW_BID' || msg.type === 'AUCTION_UPDATE') {
        fetchAuction(); // Refresh all data on websocket tick
      }
    };
    setWs(socket);
    return () => socket.close();
  }, [id, token]);

  const fetchAuction = async () => {
    try {
      const res = await fetch(`${API_URL}/auctions/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAuction(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleBid = async () => {
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= (auction?.current_bid || auction?.start_price || 0)) {
      return Alert.alert('Invalid Bid', 'Bid must be higher than current price.');
    }

    setBidding(true);
    try {
      const res = await fetch(`${API_URL}/auctions/${id}/bid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount })
      });
      
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to place bid');
      }
      
      Alert.alert('Success', 'Bid placed successfully!');
      setBidAmount('');
      fetchAuction();
    } catch (e: any) {
      Alert.alert('Bid Failed', e.message);
    } finally {
      setBidding(false);
    }
  };

  if (loading) return <View className="flex-1 justify-center items-center bg-white"><ActivityIndicator size="large" color="#ea580c" /></View>;
  if (!auction) return <View className="flex-1 justify-center items-center bg-white"><Text>Auction not found</Text></View>;

  const currentPrice = auction.current_bid || auction.start_price;
  const isOwner = user?.id === auction.seller_id;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-white">
      
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} className="flex-1">
        
        {/* Parallax Header Image */}
        <View className="relative w-full" style={{ height: height * 0.55 }}>
          <Image source={{ uri: auction.image_url || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc' }} className="w-full h-full" />
          
          <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent', 'transparent', 'rgba(0,0,0,0.8)']} className="absolute inset-0" />
          
          {/* Custom Back Button */}
          <View className="absolute top-14 left-6 z-50">
            <TouchableOpacity onPress={() => router.back()} className="w-12 h-12 rounded-full bg-white/20 items-center justify-center backdrop-blur-md">
              <ArrowLeft color="#fff" size={24} />
            </TouchableOpacity>
          </View>

          {/* Floating Time Tag */}
          <View className="absolute top-14 right-6 bg-orange-600 px-4 py-2 rounded-full flex-row items-center shadow-lg">
            <Clock color="#fff" size={16} />
            <Text className="text-white font-bold text-sm ml-2">Live Now</Text>
          </View>
        </View>

        {/* Content Body */}
        <View className="bg-white -mt-10 rounded-t-[40px] px-6 pt-8 pb-32">
          
          <View className="flex-row items-center justify-between mb-4">
            <View className="bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
              <Text className="text-orange-600 font-bold text-xs uppercase tracking-widest">{auction.category || 'Auction'}</Text>
            </View>
            <View className="flex-row items-center">
              <MapPin color="#9ca3af" size={16} />
              <Text className="text-gray-500 font-bold ml-1 text-sm">{auction.location || 'Nagpur'}</Text>
            </View>
          </View>

          <Text className="text-3xl font-black text-gray-900 leading-tight mb-4">{auction.title}</Text>
          
          <View className="flex-row items-center mb-6">
            <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center mr-3 border border-gray-200">
              <Text className="text-lg">👤</Text>
            </View>
            <View>
              <Text className="text-gray-900 font-bold">Seller Card</Text>
              <Text className="text-green-600 font-bold text-xs flex-row items-center"><ShieldCheck color="#10b981" size={12} /> Verified Member</Text>
            </View>
          </View>

          <Text className="text-gray-600 text-base leading-relaxed mb-8">{auction.description || 'No description provided.'}</Text>
          
          <View className="bg-gray-50 rounded-3xl p-6 border border-gray-100 flex-row items-center justify-between mb-8">
            <View>
              <Text className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-1">Current Bid</Text>
              <Text className="text-orange-600 font-black text-3xl">₹{currentPrice.toLocaleString()}</Text>
            </View>
            <View className="items-end">
              <Text className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-1">Total Bids</Text>
              <Text className="text-gray-900 font-black text-2xl">{auction.bids?.length || 0}</Text>
            </View>
          </View>

        </View>
      </ScrollView>

      {/* Floating Bottom Panel */}
      <View className="absolute bottom-0 left-0 right-0 p-6 pt-0 bg-white" style={{ elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.05, shadowRadius: 20 }}>
         {isOwner ? (
           <View className="bg-gray-100 h-16 rounded-2xl items-center justify-center border border-gray-200">
             <Text className="text-gray-500 font-black text-lg">You cannot bid on your own item</Text>
           </View>
         ) : (
           <View className="flex-row gap-4">
             <View className="flex-1 relative">
               <Text className="absolute left-5 top-4 z-10 text-gray-500 font-black text-xl">₹</Text>
               <TextInput
                 value={bidAmount}
                 onChangeText={setBidAmount}
                 placeholder={(currentPrice + 100).toString()}
                 keyboardType="numeric"
                 className="bg-gray-50 h-16 rounded-2xl pl-10 pr-5 text-gray-900 font-black text-xl border border-gray-200"
               />
             </View>
             <TouchableOpacity 
               disabled={bidding}
               onPress={handleBid}
               className={`h-16 px-8 rounded-2xl items-center justify-center shadow-lg ${bidding ? 'bg-orange-400' : 'bg-orange-600'}`}
             >
               {bidding ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-black text-lg">Place Bid</Text>}
             </TouchableOpacity>
           </View>
         )}
      </View>

    </KeyboardAvoidingView>
  );
}
