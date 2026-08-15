import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

/**
 * Root layout.
 *
 * GestureHandlerRootView must wrap the whole tree or the vertical drag in M1
 * silently does nothing on Android.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.surface },
            animation: 'fade',
            animationDuration: 200,
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="difficulty" />
          {/* Game Over and Pause are overlays inside `game`, not routes:
              Retry must be one tap and must not tear down the run. */}
          <Stack.Screen name="game" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="shop" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
