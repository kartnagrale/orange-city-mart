import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { API_URL, WS_URL } from '../../lib/config';
import { ArrowLeft, Send } from 'lucide-react-native';

export default function ChatDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { token, user } = useAuth();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchHistory();
  }, [id]);

  useEffect(() => {
    if (!token || !id) return;
    const socket = new WebSocket(`${WS_URL}/chat/${id}/ws?token=${token}`);
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'CHAT_MESSAGE') {
        setMessages(prev => [...prev, msg.payload]);
      }
    };
    setWs(socket);
    return () => socket.close();
  }, [id, token]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/chat/${id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setMessages(await res.json() || []);
    } catch(e) { }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    try {
      await fetch(`${API_URL}/chat/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: input.trim() })
      });
      setInput('');
      Keyboard.dismiss();
    } catch(e) { }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isMe = item.sender_id === user?.id;
    return (
      <View className={`mb-4 max-w-[80%] ${isMe ? 'self-end' : 'self-start'}`}>
        <View className={`px-5 py-3 rounded-2xl ${isMe ? 'bg-orange-600 rounded-tr-sm' : 'bg-gray-100 rounded-tl-sm'}`}>
          <Text className={`text-base ${isMe ? 'text-white' : 'text-gray-900'}`}>{item.content}</Text>
        </View>
        <Text className={`text-[10px] text-gray-400 mt-1 ${isMe ? 'text-right' : 'text-left'}`}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-white">
      
      <View className="pt-14 pb-4 px-4 border-b border-gray-100 flex-row items-center bg-white shadow-sm z-50">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center mr-2">
          <ArrowLeft color="#111827" size={24} />
        </TouchableOpacity>
        <View>
          <Text className="text-xl font-black text-gray-900">Conversation</Text>
          <Text className="text-green-500 font-bold text-xs">Online</Text>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, i) => item.id || i.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 24, paddingTop: 32 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View className="px-6 py-4 border-t border-gray-100 bg-white flex-row items-center">
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          className="flex-1 bg-gray-50 h-14 rounded-full px-6 text-gray-900 border border-gray-200"
        />
        <TouchableOpacity 
          onPress={sendMessage}
          disabled={!input.trim()}
          className={`w-14 h-14 rounded-full ml-3 items-center justify-center ${input.trim() ? 'bg-orange-600' : 'bg-orange-300'}`}
        >
          <Send color="#fff" size={20} className="ml-1" />
        </TouchableOpacity>
      </View>

    </KeyboardAvoidingView>
  );
}
