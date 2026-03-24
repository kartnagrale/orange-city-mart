import "../global.css";
import { Stack } from "expo-router";
import { AuthProvider } from "../context/AuthContext";
import { Platform, View } from "react-native"; // Added Platform and View imports

export default function RootLayout() {
  const isWeb = Platform.OS === 'web'; // Added isWeb constant
  return (
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}> {/* Added outer View */}
      <View style={[
        { flex: 1, backgroundColor: '#fff', overflow: 'hidden' },
        isWeb && { maxWidth: 450, width: '100%', alignSelf: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20 }
      ]}> {/* Added inner View with conditional styles */}
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }}> {/* Added contentStyle */}
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </AuthProvider>
      </View>
    </View>
  );
}
