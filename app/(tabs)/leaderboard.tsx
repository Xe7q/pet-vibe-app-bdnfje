
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Stack, Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { apiGet } from '@/utils/api';

interface LeaderboardEntry {
  rank: number;
  pet: {
    id: string;
    name: string;
    breed: string;
    photoUrl: string;
    likesCount: number;
    owner: {
      id: string;
      name: string;
    };
  };
}

export default function LeaderboardScreen() {
  const { user, loading: authLoading } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('LeaderboardScreen: Component mounted');
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    console.log('LeaderboardScreen: Loading top 100 pets');
    try {
      setLoading(true);
      const response = await apiGet<LeaderboardEntry[]>('/api/leaderboard');
      setLeaderboard(response);
      console.log('LeaderboardScreen: Loaded', response.length, 'entries');
    } catch (error) {
      console.error('LeaderboardScreen: Error loading leaderboard:', error);
      // Fallback to mock data if API fails
      const mockData: LeaderboardEntry[] = Array.from({ length: 20 }, (_, i) => ({
        rank: i + 1,
        pet: {
          id: `pet-${i + 1}`,
          name: ['Buddy', 'Luna', 'Max', 'Bella', 'Charlie', 'Lucy', 'Cooper', 'Daisy'][i % 8],
          breed: ['Golden Retriever', 'Siamese Cat', 'Corgi', 'Labrador', 'Poodle'][i % 5],
          photoUrl: `https://images.unsplash.com/photo-${1633722715463 + i}?w=200`,
          likesCount: 500 - i * 20,
          owner: {
            id: `user-${i + 1}`,
            name: `Owner ${i + 1}`,
          },
        },
      }));
      setLeaderboard(mockData);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    console.log('LeaderboardScreen: No user found, redirecting to auth');
    return <Redirect href="/auth" />;
  }

  const renderTopThree = () => {
    const topThree = leaderboard.slice(0, 3);
    if (topThree.length === 0) return null;

    const orderedTopThree = [topThree[1], topThree[0], topThree[2]].filter(Boolean);

    return (
      <View style={styles.topThreeContainer}>
        {orderedTopThree.map((entry, index) => {
          const actualRank = entry.rank;
          const heightMultiplier = actualRank === 1 ? 1 : actualRank === 2 ? 0.85 : 0.7;
          const crownIcon = actualRank === 1 ? '👑' : actualRank === 2 ? '🥈' : '🥉';

          return (
            <View key={entry.pet.id} style={[styles.topThreeItem, { flex: 1 }]}>
              <View style={styles.crownContainer}>
                <Text style={styles.crownEmoji}>{crownIcon}</Text>
              </View>
              <View
                style={[
                  styles.topThreeImageContainer,
                  actualRank === 1 && styles.firstPlaceGlow,
                  { height: 100 * heightMultiplier },
                ]}
              >
                <Image source={{ uri: entry.pet.photoUrl }} style={styles.topThreeImage} />
              </View>
              <Text style={styles.topThreeName} numberOfLines={1}>
                {entry.pet.name}
              </Text>
              <View style={styles.likesContainer}>
                <IconSymbol
                  ios_icon_name="heart.fill"
                  android_material_icon_name="favorite"
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.likesText}>{entry.pet.likesCount}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    if (item.rank <= 3) return null;

    return (
      <TouchableOpacity style={styles.listItem}>
        <View style={styles.rankContainer}>
          <Text style={styles.rankText}>{item.rank}</Text>
        </View>
        <Image source={{ uri: item.pet.photoUrl }} style={styles.listItemImage} />
        <View style={styles.listItemInfo}>
          <Text style={styles.listItemName}>{item.pet.name}</Text>
          <Text style={styles.listItemBreed}>{item.pet.breed}</Text>
        </View>
        <View style={styles.listItemLikes}>
          <IconSymbol
            ios_icon_name="heart.fill"
            android_material_icon_name="favorite"
            size={16}
            color={colors.primary}
          />
          <Text style={styles.listItemLikesText}>{item.pet.likesCount}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Hall of Paws',
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: 'bold',
            color: colors.text,
          },
        }}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item.pet.id}
          renderItem={renderItem}
          ListHeaderComponent={
            <>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Top 100 Hall of Paws</Text>
                <Text style={styles.headerSubtitle}>Most loved pets on PawPaw</Text>
              </View>
              {renderTopThree()}
              {leaderboard.length > 3 && (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>Top 100</Text>
                </View>
              )}
            </>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  topThreeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: colors.backgroundSecondary,
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  topThreeItem: {
    alignItems: 'center',
  },
  crownContainer: {
    marginBottom: 8,
  },
  crownEmoji: {
    fontSize: 32,
  },
  topThreeImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: colors.primary,
    overflow: 'hidden',
    marginBottom: 8,
  },
  firstPlaceGlow: {
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 8,
  },
  topThreeImage: {
    width: '100%',
    height: '100%',
  },
  topThreeName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  likesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likesText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.backgroundSecondary,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  listContent: {
    paddingBottom: 100,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
  listItemImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  listItemInfo: {
    flex: 1,
  },
  listItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  listItemBreed: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  listItemLikes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listItemLikesText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
