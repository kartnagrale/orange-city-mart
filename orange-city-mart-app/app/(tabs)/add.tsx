import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, MapPin, Tag, Plus, X } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../lib/config';

const CATEGORIES = ['Electronics', 'Furniture', 'Fashion', 'Vehicles', 'Properties', 'Sports', 'Other'];

export default function SellItem() {
  const router = useRouter();
  const { token } = useAuth();

  const [listingType, setListingType] = useState<'FIXED' | 'AUCTION'>('FIXED');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [price, setPrice] = useState('');
  const [startPrice, setStartPrice] = useState('');
  const [location, setLocation] = useState('');
  
  // Date Picker State
  const [endDate, setEndDate] = useState<Date>(new Date(Date.now() + 86400000));
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      await uploadImage(uri);
    }
  };

  const uploadImage = async (uri: string) => {
    setUploading(true);
    try {
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;

      const formData = new FormData();
      // @ts-ignore
      formData.append('image', { uri, name: filename, type });

      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setImageUrl(data.url);
    } catch (err) {
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title || !category || !location) {
      Alert.alert('Missing Info', 'Please fill in all required fields marked with *');
      return;
    }
    
    if (listingType === 'FIXED' && !price) return Alert.alert('Error', 'Price is required');
    if (listingType === 'AUCTION' && !startPrice) return Alert.alert('Error', 'Starting price is required');

    setSubmitting(true);
    try {
      const payload: any = { type: listingType, title, description, category, image_url: imageUrl, location };

      if (listingType === 'FIXED') {
         payload.price = parseFloat(price);
         if (isNaN(payload.price)) throw new Error('Invalid price');
      } else {
         payload.start_price = parseFloat(startPrice);
         if (isNaN(payload.start_price)) throw new Error('Invalid starting price');
         
         if (endDate < new Date()) throw new Error('End date must be in the future');
         payload.end_time = endDate.toISOString();
      }

      const res = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to create listing');
      
      Alert.alert('Success!', 'Your item is now live on the marketplace.', [{
        text: 'Awesome',
        onPress: () => {
          setTitle(''); setDescription(''); setPrice(''); setStartPrice(''); setLocation('');
          setImageUrl(null); setImageUri(null);
          router.replace('/(tabs)');
        }
      }]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-white">
      {/* Blurred Header */}
      <View className="absolute top-0 left-0 right-0 z-50 pt-12 pb-4 px-6 bg-white/80" style={{ overflow: 'hidden' }}>
        <BlurView intensity={80} tint="light" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <Text className="text-3xl font-black text-gray-900 leading-tight">Create Listing</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: 120, paddingBottom: 120 }}>
        <View className="px-6">
          
          {/* Type Selector Toggle */}
          <View className="flex-row bg-gray-100 p-1.5 rounded-full mb-8">
            <TouchableOpacity 
              onPress={() => setListingType('FIXED')}
              className={`flex-1 py-3 rounded-full items-center ${listingType === 'FIXED' ? 'bg-white shadow-sm' : ''}`}
            >
              <Text className={`font-bold ${listingType === 'FIXED' ? 'text-gray-900' : 'text-gray-500'}`}>Fix Price</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setListingType('AUCTION')}
              className={`flex-1 py-3 rounded-full items-center ${listingType === 'AUCTION' ? 'bg-white shadow-sm' : ''}`}
            >
              <Text className={`font-bold ${listingType === 'AUCTION' ? 'text-orange-600' : 'text-gray-500'}`}>Live Auction</Text>
            </TouchableOpacity>
          </View>

          {/* Image Upload Area */}
          <TouchableOpacity 
            onPress={pickImage} 
            activeOpacity={0.8}
            className="w-full h-56 bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-200 justify-center items-center mb-6 overflow-hidden"
          >
            {imageUri ? (
              <View className="w-full h-full relative">
                <Image source={{ uri: imageUri }} className="w-full h-full" />
                {uploading && (
                  <View className="absolute inset-0 bg-black/40 items-center justify-center">
                    <ActivityIndicator size="large" color="#ffffff" />
                    <Text className="text-white font-bold mt-2">Uploading...</Text>
                  </View>
                )}
              </View>
            ) : (
              <View className="items-center">
                <View className="w-16 h-16 bg-white rounded-full items-center justify-center shadow-sm mb-3">
                  <Camera color="#ea580c" size={28} />
                </View>
                <Text className="text-gray-900 font-bold text-lg">Add Cover Photo</Text>
                <Text className="text-gray-400 font-medium text-xs mt-1">Tap to select from gallery</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Form Inputs */}
          <View className="mb-4">
            <Text className="text-gray-900 font-bold ml-1 mb-2">Title *</Text>
            <TextInput 
              value={title} onChangeText={setTitle} 
              className="bg-gray-50 h-14 rounded-2xl px-5 text-gray-900 font-medium text-base border border-gray-100" 
              placeholder="What are you selling?" 
            />
          </View>

          {/* Category Scroller */}
          <Text className="text-gray-900 font-bold ml-1 mb-2">Category *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6 -mx-6 px-6">
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategory(cat)}
                className={`mr-3 px-5 py-3 rounded-full border ${category === cat ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-200'}`}
              >
                <Text className={`font-bold ${category === cat ? 'text-white' : 'text-gray-600'}`}>{cat}</Text>
              </TouchableOpacity>
            ))}
            <View className="w-12 h-1" />
          </ScrollView>

          <View className="mb-6">
            <Text className="text-gray-900 font-bold ml-1 mb-2">Description</Text>
            <TextInput 
              value={description} onChangeText={setDescription} 
              multiline numberOfLines={4}
              className="bg-gray-50 rounded-2xl p-5 text-gray-900 font-medium text-base h-32 border border-gray-100" 
              placeholder="Describe your item in detail..." 
              textAlignVertical="top"
            />
          </View>

          {/* Dynamic Pricing Seciton */}
          <View className="flex-row gap-4 mb-6">
            <View className="flex-1">
              <Text className="text-gray-900 font-bold ml-1 mb-2">
                {listingType === 'FIXED' ? 'Price (₹) *' : 'Starting Bid (₹) *'}
              </Text>
              <TextInput 
                value={listingType === 'FIXED' ? price : startPrice} 
                onChangeText={listingType === 'FIXED' ? setPrice : setStartPrice} 
                keyboardType="numeric"
                className="bg-gray-50 h-14 rounded-2xl px-5 text-xl font-black text-gray-900 border border-gray-100" 
                placeholder="0" 
              />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 font-bold ml-1 mb-2">Location *</Text>
              <View className="relative justify-center">
                 <TextInput 
                   value={location} onChangeText={setLocation} 
                   className="bg-gray-50 h-14 rounded-2xl pl-11 pr-4 text-gray-900 font-medium text-base border border-gray-100" 
                   placeholder="E.g. Sadar" 
                 />
                 <MapPin color="#9ca3af" size={18} className="absolute left-4 z-10" />
              </View>
            </View>
          </View>

          {/* Auction End Time */}
          {listingType === 'AUCTION' && (
            <View className="mb-6">
              <Text className="text-gray-900 font-bold ml-1 mb-2">Auction End Time *</Text>
              <View className="flex-row gap-4">
                <TouchableOpacity 
                  onPress={() => { Keyboard.dismiss(); setPickerMode('date'); setShowPicker(true); }}
                  className="flex-1 bg-gray-50 border border-gray-100 h-14 rounded-2xl px-5 justify-center"
                >
                  <Text className="text-gray-900 font-bold">{endDate.toLocaleDateString()}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => { Keyboard.dismiss(); setPickerMode('time'); setShowPicker(true); }}
                  className="flex-1 bg-gray-50 border border-gray-100 h-14 rounded-2xl px-5 justify-center"
                >
                  <Text className="text-gray-900 font-bold">{endDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                </TouchableOpacity>
              </View>

              {showPicker && (
                <DateTimePicker
                  value={endDate}
                  mode={pickerMode}
                  display="default"
                  minimumDate={new Date()}
                  onChange={(event: any, selectedDate?: Date) => {
                    if (Platform.OS === 'android') setShowPicker(false);
                    if (selectedDate) setEndDate(selectedDate);
                  }}
                />
              )}
            </View>
          )}

          {/* Submit Action */}
          <TouchableOpacity 
            onPress={handleSubmit}
            disabled={submitting || uploading}
            className={`h-16 rounded-2xl items-center justify-center flex-row shadow-lg ${submitting || uploading ? 'bg-gray-400' : 'bg-orange-600'}`}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" className="mr-2" />
            ) : (
              <Plus color="#ffffff" size={24} className="mr-2" strokeWidth={3} />
            )}
            <Text className="text-white font-black text-lg">{submitting ? 'Publishing...' : 'Publish Listing'}</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
