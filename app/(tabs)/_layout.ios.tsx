
import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

export default function TabLayout() {
  const router = useRouter();

  // Define the tabs configuration
  const tabs: TabBarItem[] = [
    {
      name: '(home)',
      route: '/(tabs)/(home)/',
      icon: 'home',
      label: 'Home',
    },
    {
      name: 'leaderboard',
      route: '/(tabs)/leaderboard',
      icon: 'emoji-events',
      label: 'Leaderboard',
    },
    {
      name: 'matches',
      route: '/(tabs)/matches',
      icon: 'favorite',
      label: 'Matches',
    },
    {
      name: 'profile',
      route: '/(tabs)/profile',
      icon: 'person',
      label: 'Profile',
    },
  ];

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
        }}
      >
        <Stack.Screen key="home" name="(home)" />
        <Stack.Screen key="leaderboard" name="leaderboard" />
        <Stack.Screen key="matches" name="matches" />
        <Stack.Screen key="profile" name="profile" />
      </Stack>
      <FloatingTabBar tabs={tabs} />
      
      {/* Go Live Button - Floating in center */}
      <TouchableOpacity
        style={styles.goLiveButton}
        onPress={() => router.push('/live/start')}
        activeOpacity={0.8}
      >
        <View style={styles.goLiveInner}>
          <IconSymbol
            ios_icon_name="video.fill"
            android_material_icon_name="videocam"
            size={28}
            color="#fff"
          />
        </View>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  goLiveButton: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  goLiveInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
