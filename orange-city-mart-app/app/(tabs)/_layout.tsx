import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { View, Platform, StyleSheet } from 'react-native';
import { Home, Search, Plus, Wallet, History } from 'lucide-react-native';
import { useProtectedRoute } from '../../hooks/useProtectedRoute';

export default function TabLayout() {
  // Enforce protection for everything inside the tabs
  useProtectedRoute();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 24,
          alignSelf: 'center',
          width: Platform.OS === 'web' ? 400 : 'auto',
          left: Platform.OS === 'web' ? 'auto' : 24,
          right: Platform.OS === 'web' ? 'auto' : 24,
          elevation: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          height: 72,
          borderRadius: 36,
          shadowColor: '#f97316',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.2,
          shadowRadius: 20,
        },
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            <BlurView
              tint="systemMaterialLight"
              intensity={80}
              style={{
                flex: 1,
                borderRadius: 36,
                overflow: 'hidden',
                backgroundColor: 'rgba(255, 255, 255, 0.7)'
              }}
            />
          </View>
        ),
        tabBarActiveTintColor: '#ea580c',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color }) => <Home color={color} size={26} strokeWidth={2.5} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ color }) => <Search color={color} size={26} strokeWidth={2.5} />,
        }}
      />
      
      {/* Floating Action Button (FAB) replacement for middle tab */}
      <Tabs.Screen
        name="add"
        options={{
          tabBarIcon: ({ focused }) => (
            <View 
              className={`w-14 h-14 rounded-full items-center justify-center -mt-8 ${focused ? 'bg-orange-600' : 'bg-orange-500'}`}
              style={{
                shadowColor: '#ea580c',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 10,
                elevation: 5,
              }}
            >
              <Plus color="#ffffff" size={32} strokeWidth={3} />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color }) => <History color={color} size={26} strokeWidth={2.5} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          tabBarIcon: ({ color }) => <Wallet color={color} size={26} strokeWidth={2.5} />,
        }}
      />
    </Tabs>
  );
}
