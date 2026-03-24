import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { User, LogOut, Settings, History, ShieldCheck, ChevronRight } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="absolute top-0 left-0 right-0 z-50 pt-12 pb-4 px-6 bg-white/80" style={{ overflow: 'hidden' }}>
        <BlurView intensity={80} tint="light" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <Text className="text-3xl font-black text-gray-900 leading-tight">My Profile</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: 120, paddingBottom: 120 }}>
        
        {/* User Card */}
        <View className="px-6 mb-8 mt-4 items-center">
          <View className="w-24 h-24 bg-orange-100 rounded-full items-center justify-center mb-4">
             <User color="#ea580c" size={40} />
          </View>
          <Text className="text-3xl font-black text-gray-900">{user?.name || 'Local Member'}</Text>
          <Text className="text-gray-500 font-bold mb-2">{user?.email || 'member@orangecity.com'}</Text>
          <View className="flex-row items-center bg-green-50 px-3 py-1 rounded-full border border-green-100 mt-2">
             <ShieldCheck color="#10b981" size={14} />
             <Text className="text-green-600 font-bold ml-1 text-sm">Verified Account</Text>
          </View>
        </View>

        {/* Menu Links */}
        <View className="px-6 space-y-4">
          
          <Text className="text-gray-900 font-black text-xl mb-2">My Activity</Text>
          
          <TouchableOpacity 
            onPress={() => router.push('/(tabs)/bids')}
            className="bg-white px-5 py-4 rounded-2xl flex-row items-center justify-between border border-gray-100 shadow-sm"
          >
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center mr-3">
                <History color="#3b82f6" size={20} />
              </View>
              <Text className="text-gray-900 font-bold text-lg">My Bids & Offers</Text>
            </View>
            <ChevronRight color="#d1d5db" size={20} />
          </TouchableOpacity>

          <TouchableOpacity className="bg-white px-5 py-4 rounded-2xl flex-row items-center justify-between border border-gray-100 shadow-sm mt-3">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center mr-3">
                <Settings color="#6b7280" size={20} />
              </View>
              <Text className="text-gray-900 font-bold text-lg">Account Settings</Text>
            </View>
            <ChevronRight color="#d1d5db" size={20} />
          </TouchableOpacity>

          <Text className="text-gray-900 font-black text-xl mt-6 mb-2">System</Text>

          <TouchableOpacity 
            onPress={handleLogout}
            className="bg-red-50 px-5 py-4 rounded-2xl flex-row items-center justify-between border border-red-100 shadow-sm align-center"
          >
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-white rounded-full items-center justify-center mr-3">
                <LogOut color="#ef4444" size={20} />
              </View>
              <Text className="text-red-600 font-bold text-lg">Sign Out</Text>
            </View>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  );
}
