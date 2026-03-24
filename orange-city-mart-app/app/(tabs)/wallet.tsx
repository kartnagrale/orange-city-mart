import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Clock, ShieldCheck } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../lib/config';

export default function Wallet() {
  const { token, user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    try {
      const res = await fetch(`${API_URL}/wallet`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
      }
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="absolute top-0 left-0 right-0 z-50 pt-12 pb-4 px-6 bg-white/80" style={{ overflow: 'hidden' }}>
        <BlurView intensity={80} tint="light" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <Text className="text-3xl font-black text-gray-900 leading-tight">Digital Wallet</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: 120, paddingBottom: 120 }}>
        <View className="px-6">
          
          <LinearGradient
            colors={['#111827', '#1f2937', '#030712']}
            className="w-full rounded-[32px] p-6 mb-8 shadow-2xl relative overflow-hidden"
          >
            <View className="absolute -top-20 -right-20 w-64 h-64 bg-white/5 rounded-full" />
            
            <View className="flex-row items-center justify-between mb-8">
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-white/10 rounded-full items-center justify-center mr-3">
                  <WalletIcon color="#fff" size={20} />
                </View>
                <Text className="text-gray-300 font-medium">Available Balance</Text>
              </View>
              <ShieldCheck color="#10b981" size={24} />
            </View>

            {loading ? (
               <ActivityIndicator color="#fff" size="large" className="my-4" />
            ) : (
               <Text className="text-white text-5xl font-black mb-2 tracking-tight">
                 ₹{balance?.toLocaleString() || '0'}
               </Text>
            )}
            <Text className="text-gray-400 text-sm font-medium">Secured by Orange City Pay</Text>
            
            <View className="flex-row mt-8 gap-4">
               <TouchableOpacity className="flex-1 bg-orange-600 h-14 rounded-2xl items-center justify-center flex-row">
                 <ArrowDownLeft color="#fff" size={20} className="mr-2" />
                 <Text className="text-white font-bold text-base">Top Up</Text>
               </TouchableOpacity>
               <TouchableOpacity className="flex-1 bg-white/10 h-14 rounded-2xl items-center justify-center flex-row">
                 <ArrowUpRight color="#fff" size={20} className="mr-2" />
                 <Text className="text-white font-bold text-base">Withdraw</Text>
               </TouchableOpacity>
            </View>
          </LinearGradient>

          <Text className="text-xl font-black text-gray-900 mb-6">Recent Activity</Text>
          
          {[1,2,3].map((i) => (
             <View key={i} className="flex-row items-center justify-between bg-white p-4 rounded-2xl mb-3 shadow-sm border border-gray-100">
               <View className="flex-row items-center">
                 <View className="w-12 h-12 bg-gray-50 rounded-full items-center justify-center mr-4">
                   <Clock color="#9ca3af" size={20} />
                 </View>
                 <View>
                   <Text className="text-gray-900 font-bold text-base">Wallet Deposit</Text>
                   <Text className="text-gray-500 text-xs mt-0.5">Today, 10:42 AM</Text>
                 </View>
               </View>
               <Text className="text-green-600 font-bold text-lg">+₹5,000</Text>
             </View>
          ))}

        </View>
      </ScrollView>
    </View>
  );
}
