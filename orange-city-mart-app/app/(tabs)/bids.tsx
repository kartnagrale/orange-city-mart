import { View, Text, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { History, Inbox } from 'lucide-react-native';

export default function MyBids() {
  return (
    <View className="flex-1 bg-gray-50">
      <View className="absolute top-0 left-0 right-0 z-50 pt-12 pb-4 px-6 bg-white/80" style={{ overflow: 'hidden' }}>
        <BlurView intensity={80} tint="light" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <Text className="text-3xl font-black text-gray-900 leading-tight">My Bids</Text>
      </View>

      <View className="flex-1 items-center justify-center">
        <View className="w-24 h-24 bg-orange-50 rounded-full items-center justify-center mb-6">
          <Inbox color="#ea580c" size={40} />
        </View>
        <Text className="text-2xl font-black text-gray-900 mb-2">No active bids</Text>
        <Text className="text-gray-500 text-center px-10">When you place a bid on a live auction, you can track its status here.</Text>
      </View>
    </View>
  );
}
