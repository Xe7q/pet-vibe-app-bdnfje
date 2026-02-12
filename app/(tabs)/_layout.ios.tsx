
import React from 'react';
import { Stack } from 'expo-router';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';

export default function TabLayout() {
  // Define the tabs configuration - including Go Live in the center
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
      name: 'go-live',
      route: '/live/start',
      icon: 'videocam',
      label: 'Go Live',
      isSpecial: true, // Mark this as the special center button
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
      <FloatingTabBar 
        tabs={tabs} 
        containerWidth={380}
        borderRadius={35}
        bottomMargin={10}
      />
    </>
  );
}
