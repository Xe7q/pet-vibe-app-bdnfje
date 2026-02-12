import React from 'react';
import { Stack } from 'expo-router';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';

export default function TabLayout() {
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

  // For Android and Web, use Stack navigation with custom floating tab bar
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none', // Remove fade animation to prevent black screen flash
        }}
      >
        <Stack.Screen key="home" name="(home)" />
        <Stack.Screen key="leaderboard" name="leaderboard" />
        <Stack.Screen key="matches" name="matches" />
        <Stack.Screen key="profile" name="profile" />
      </Stack>
      <FloatingTabBar tabs={tabs} />
    </>
  );
}
