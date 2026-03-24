import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useRouter, Link } from 'expo-router';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Login Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white justify-center px-6">
      <View className="items-center mb-8">
        <Text className="text-3xl font-bold text-orange-600">Orange City Mart</Text>
        <Text className="text-gray-500 mt-2 text-base">Welcome back! Please login.</Text>
      </View>

      <View className="space-y-4">
        <TextInput
          className="bg-gray-100 p-4 rounded-xl text-lg"
          placeholder="Email address"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          className="bg-gray-100 p-4 rounded-xl text-lg mt-4"
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity 
          className="bg-orange-500 p-4 rounded-xl items-center mt-6 flex-row justify-center"
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" className="mr-2" /> : null}
          <Text className="text-white font-bold text-lg">Login</Text>
        </TouchableOpacity>
      </View>

      <View className="mt-8 flex-row justify-center items-center">
        <Text className="text-gray-500 text-base">Don't have an account? </Text>
        <Link href="/(auth)/register" asChild>
          <TouchableOpacity>
            <Text className="text-orange-500 font-bold text-base">Register</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </SafeAreaView>
  );
}
