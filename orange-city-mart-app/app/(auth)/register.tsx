import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useRouter, Link } from 'expo-router';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white justify-center px-6">
      <View className="items-center mb-8">
        <Text className="text-3xl font-bold text-orange-600">Create Account</Text>
        <Text className="text-gray-500 mt-2 text-base">Join Orange City Mart today.</Text>
      </View>

      <View className="space-y-4">
        <TextInput
          className="bg-gray-100 p-4 rounded-xl text-lg"
          placeholder="Full Name"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          className="bg-gray-100 p-4 rounded-xl text-lg mt-4"
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
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" className="mr-2" /> : null}
          <Text className="text-white font-bold text-lg">Sign Up</Text>
        </TouchableOpacity>
      </View>

      <View className="mt-8 flex-row justify-center items-center">
        <Text className="text-gray-500 text-base">Already have an account? </Text>
        <Link href="/(auth)/login" asChild>
          <TouchableOpacity>
            <Text className="text-orange-500 font-bold text-base">Login</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </SafeAreaView>
  );
}
