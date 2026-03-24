import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export function useProtectedRoute() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // Check if the current route is within the protected groups
    const guardedSegments = ['(tabs)', 'auctions', 'listings', 'chat'];
    const inProtectedRouteGroup = guardedSegments.includes(segments[0]);

    if (!user && inProtectedRouteGroup) {
      // Redirect to the login page
      router.replace('/(auth)/login');
    } else if (user && !inProtectedRouteGroup) {
       // if they are on index or login, let them explore. But typically we keep them logged in.
       if (segments[0] === '(auth)' || !segments.length) {
          router.replace('/(tabs)');
       }
    }
  }, [user, segments, isLoading]);
}
