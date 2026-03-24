import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Gavel, Wifi, WifiOff, Clock, Wallet, AlertCircle } from 'lucide-react-native';
import { useAuctionSocket } from '../hooks/useAuctionSocket';
import { API_URL } from '../lib/config';

interface BidPanelProps {
  auctionId: string;
  endTime: string;          // ISO 8601
  initialBid: number;
  startPrice: number;
  userId: string;
  walletBalance: number;
  token: string | null;
}

function useCountdown(endTime: string) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(endTime).getTime() - Date.now())
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(Math.max(0, new Date(endTime).getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  const expired = remaining === 0;
  return { hours, minutes, seconds, expired };
}

export default function BidPanel({
  auctionId,
  endTime,
  initialBid,
  startPrice,
  userId,
  walletBalance,
  token,
}: BidPanelProps) {
  const { currentBid, isConnected } = useAuctionSocket({ auctionId, userId, initialBid });
  const { hours, minutes, seconds, expired } = useCountdown(endTime);
  const [bidAmount, setBidAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const minBid = Math.max(startPrice, currentBid) + 1;
  const parsedAmount = parseFloat(bidAmount);
  const isInsufficient = !isNaN(parsedAmount) && parsedAmount > walletBalance;
  const balanceAfterBid = !isNaN(parsedAmount) ? walletBalance - parsedAmount : walletBalance;

  const handleBid = async () => {
    if (isNaN(parsedAmount) || parsedAmount < minBid) {
      Alert.alert('Error', `Minimum bid is ₹${minBid.toLocaleString('en-IN')}`);
      return;
    }
    if (parsedAmount > walletBalance) {
      Alert.alert('Error', 'Insufficient wallet balance');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auctions/${auctionId}/bid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ amount: parsedAmount }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text.trim() || 'Bid failed');
      }
      Alert.alert('Success', `Bid of ₹${parsedAmount.toLocaleString('en-IN')} placed! Funds soft-blocked.`);
      setBidAmount('');
    } catch (err: any) {
      Alert.alert('Bid Failed', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mt-6">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide">Live Auction</Text>
        <View className={`flex-row items-center gap-1 px-3 py-1 rounded-full ${isConnected ? 'bg-green-100' : 'bg-gray-100'}`}>
          {isConnected ? <Wifi color="#15803d" size={12} /> : <WifiOff color="#6b7280" size={12} />}
          <Text className={`text-xs font-medium ${isConnected ? 'text-green-700' : 'text-gray-500'}`}>
            {isConnected ? 'Connected' : 'Reconnecting…'}
          </Text>
        </View>
      </View>

      <View className="bg-orange-50 rounded-2xl p-4 items-center mb-4 border border-orange-100">
        <Text className="text-xs text-orange-700 font-bold mb-1 uppercase tracking-wider">Current Highest Bid</Text>
        <Text className="text-4xl font-extrabold text-orange-600">
          ₹{currentBid > 0 ? currentBid.toLocaleString('en-IN') : startPrice.toLocaleString('en-IN')}
        </Text>
      </View>

      <View className="flex-row items-center justify-center gap-2 mb-4">
        <Clock color="#9ca3af" size={18} />
        {expired ? (
          <Text className="text-red-500 font-bold text-lg">Auction Ended</Text>
        ) : (
          <Text className="text-3xl font-bold tracking-widest text-gray-800">
            {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </Text>
        )}
      </View>

      <View className="flex-row items-center justify-between bg-gray-50 rounded-xl px-4 py-3 mb-4">
        <View className="flex-row items-center gap-2">
          <Wallet color="#6b7280" size={16} /> 
          <Text className="text-sm font-semibold text-gray-600">Your Wallet</Text>
        </View>
        <Text className="text-sm font-extrabold text-gray-900">
          ₹{walletBalance.toLocaleString('en-IN')}
        </Text>
      </View>

      {!expired && (
        <View>
          <View className="relative mb-3">
            <Text className="absolute left-4 top-1/2 -translate-y-[10px] font-bold text-gray-500 z-10">₹</Text>
            <TextInput
              keyboardType="numeric"
              className={`bg-gray-100 h-14 rounded-xl pl-8 text-lg font-bold text-gray-900 ${isInsufficient ? 'border border-red-400 bg-red-50' : ''}`}
              placeholder={`Min. ₹${minBid.toLocaleString('en-IN')}`}
              value={bidAmount}
              onChangeText={setBidAmount}
            />
          </View>

          {isInsufficient && (
             <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-2 mb-3">
               <AlertCircle color="#dc2626" size={14} />
               <Text className="text-red-600 text-xs font-semibold">Insufficient wallet balance.</Text>
             </View>
          )}

          {!isInsufficient && bidAmount !== '' && !isNaN(parsedAmount) && parsedAmount >= minBid && (
            <Text className="text-xs text-gray-500 text-center mb-3">
              Balance after bid: <Text className="font-bold text-gray-700">₹{balanceAfterBid.toLocaleString('en-IN')}</Text>
            </Text>
          )}

          <TouchableOpacity
            onPress={handleBid}
            disabled={isSubmitting || !isConnected || isInsufficient}
            className={`bg-orange-600 h-14 rounded-xl items-center flex-row justify-center ${(isSubmitting || !isConnected || isInsufficient) ? 'opacity-70' : ''}`}
          >
            {isSubmitting ? <ActivityIndicator color="#ffffff" className="mr-2" /> : <Gavel color="#ffffff" size={18} className="mr-2" />}
            <Text className="text-white font-bold text-lg">{isSubmitting ? 'Placing bid…' : 'Place Bid'}</Text>
          </TouchableOpacity>
          <Text className="text-[10px] text-center text-gray-400 mt-3 leading-relaxed">
            Bid amount is <Text className="font-bold text-gray-500">soft-blocked</Text> from your wallet. Released instantly if outbid.
          </Text>
        </View>
      )}
    </View>
  );
}
