import { Platform } from 'react-native';

// Dynamically point to the local PC's Wi-Fi IP address or loopback for web
const isWeb = Platform.OS === 'web';
const localhost = isWeb ? '127.0.0.1' : '10.0.2.2';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || `http://${localhost}/api`;
export const WS_URL = process.env.EXPO_PUBLIC_WS_URL || `ws://${localhost}/ws`;
