import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { Search as SearchIcon, X, TrendingUp, MapPin } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { API_URL } from '../../lib/config';

const TRENDING = ['Vintage Furniture', 'Gaming Laptops', 'Bicycles', 'Sneakers'];

export default function Search() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    
    // Simple debounce
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/products?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data || []);
        }
      } catch (e) {} finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <View className="flex-1 bg-gray-50">
      <View className="absolute top-0 left-0 right-0 z-50 pt-12 pb-4 px-6 bg-white/80" style={{ overflow: 'hidden' }}>
        <BlurView intensity={80} tint="light" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        
        <View className="relative justify-center">
          <TextInput
            value={query}
            onChangeText={setQuery}
            className="w-full bg-gray-100 h-14 rounded-2xl pl-12 pr-12 text-gray-900 font-bold text-base"
            placeholder="Search Marketplace..."
            autoFocus
          />
          <SearchIcon color="#9ca3af" size={24} className="absolute left-4 z-10" />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} className="absolute right-4 z-10 w-6 h-6 bg-gray-300 rounded-full items-center justify-center">
              <X color="#fff" size={14} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: 130, paddingBottom: 120 }}>
        <View className="px-6">
          
          {query.trim() === '' ? (
            <View>
              <View className="flex-row items-center mb-6">
                <TrendingUp color="#ea580c" size={24} />
                <Text className="text-xl font-black text-gray-900 ml-2">Trending Searches</Text>
              </View>
              
              <View className="flex-row flex-wrap">
                {TRENDING.map((term, i) => (
                  <TouchableOpacity key={i} onPress={() => setQuery(term)} className="bg-white border border-gray-100 px-5 py-3 rounded-full mr-3 mb-3 shadow-sm">
                    <Text className="text-gray-900 font-bold">{term}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View>
               <Text className="text-xl font-black text-gray-900 mb-6">Results for "{query}"</Text>
               
               {loading && <ActivityIndicator color="#ea580c" size="large" />}
               
               {!loading && results.map((item) => (
                 <TouchableOpacity 
                    key={item.id}
                    onPress={() => router.push(`/${item.type === 'AUCTION' ? 'auctions' : 'listings'}/${item.id}`)}
                    className="bg-white p-4 rounded-2xl mb-4 shadow-sm border border-gray-100 flex-row items-center"
                 >
                    <Image source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc' }} className="w-20 h-20 rounded-xl mr-4" />
                    <View className="flex-1">
                       <Text className="text-gray-900 font-bold text-lg mb-1" numberOfLines={1}>{item.title}</Text>
                       <Text className="text-gray-500 text-xs mb-2 flex-row items-center"><MapPin color="#9ca3af" size={12} /> {item.location || 'Nagpur'}</Text>
                       <Text className="text-orange-600 font-black text-lg">₹{item.price?.toLocaleString() || item.start_price?.toLocaleString()}</Text>
                    </View>
                 </TouchableOpacity>
               ))}
               
               {!loading && results.length === 0 && (
                 <Text className="text-gray-500 font-bold text-center mt-10">No items found.</Text>
               )}
            </View>
          )}

        </View>
      </ScrollView>
    </View>
  );
}
