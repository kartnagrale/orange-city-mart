import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { ShoppingBag, Search, Wallet, MessageCircle, Gavel, Plus, Bell, LogOut, LogIn } from 'lucide-react-native';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isActive = (path: string) => pathname === path;
  const activeColor = '#ea580c'; // orange-600
  const inactiveColor = '#4b5563'; // gray-600

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    router.replace('/');
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '';

  return (
    <SafeAreaView edges={['top']} className="bg-white border-b border-gray-100 shadow-sm z-50">
      <View className="flex-row items-center justify-between h-16 px-4">
        {/* Logo */}
        <TouchableOpacity onPress={() => router.push('/')} className="flex-row items-center">
          <View className="w-8 h-8 bg-orange-500 rounded-lg items-center justify-center mr-2">
            <ShoppingBag color="#ffffff" size={18} />
          </View>
          <Text className="font-bold text-gray-900 text-lg hidden sm:flex">
            Orange City <Text className="text-orange-500">Mart</Text>
          </Text>
        </TouchableOpacity>

        {/* Icons mapped from Web */}
        <View className="flex-row items-center gap-1">
          <TouchableOpacity onPress={() => router.push('/(protected)/dashboard')} className="p-2">
            <Gavel color={isActive('/(protected)/dashboard') ? activeColor : inactiveColor} size={20} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(protected)/my-bids')} className="p-2">
            <Bell color={isActive('/(protected)/my-bids') ? activeColor : inactiveColor} size={20} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(protected)/chat/1')} className="p-2">
            <MessageCircle color={isActive('/(protected)/chat/1') ? activeColor : inactiveColor} size={20} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(protected)/wallet')} className="p-2">
            <Wallet color={isActive('/(protected)/wallet') ? activeColor : inactiveColor} size={20} />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push('/(protected)/listings/new')} 
            className="flex-row items-center bg-orange-600 px-3 py-1.5 rounded-lg ml-2"
          >
            <Plus color="#ffffff" size={16} />
            <Text className="text-white text-xs font-bold ml-1">Sell</Text>
          </TouchableOpacity>

          {/* Auth Handling */}
          {user ? (
            <View className="relative z-50 ml-2">
              <TouchableOpacity
                onPress={() => setDropdownOpen(!dropdownOpen)}
                className="w-8 h-8 bg-orange-500 rounded-full items-center justify-center"
              >
                <Text className="text-white text-xs font-bold">{initials}</Text>
              </TouchableOpacity>

              {dropdownOpen && (
                <View className="absolute top-10 right-0 w-48 bg-white border border-gray-100 rounded-xl shadow-lg pb-2 pt-1 z-50">
                  <View className="px-4 py-3 border-b border-gray-50">
                    <Text className="text-sm font-semibold text-gray-900 truncate">{user.name}</Text>
                    <Text className="text-xs text-gray-400 truncate">{user.email}</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => { setDropdownOpen(false); router.push('/(protected)/wallet'); }}
                    className="flex-row items-center px-4 py-3 border-b border-gray-50"
                  >
                    <Wallet color="#4b5563" size={16} />
                    <Text className="text-gray-700 ml-2 text-sm">Wallet</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => { setDropdownOpen(false); router.push('/(protected)/my-bids'); }}
                    className="flex-row items-center px-4 py-3 border-b border-gray-50"
                  >
                    <Bell color="#4b5563" size={16} />
                    <Text className="text-gray-700 ml-2 text-sm">My Bids</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={handleLogout}
                    className="flex-row items-center px-4 py-3"
                  >
                    <LogOut color="#ef4444" size={16} />
                    <Text className="text-red-500 ml-2 text-sm">Sign Out</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <TouchableOpacity 
              onPress={() => router.push('/(auth)/login')}
              className="flex-row items-center ml-2"
            >
              <LogIn color="#4b5563" size={18} />
              <Text className="text-gray-700 text-sm font-bold ml-1">Sign In</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
