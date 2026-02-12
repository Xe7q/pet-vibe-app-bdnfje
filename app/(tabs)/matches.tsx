
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
import { Stack, Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedGet } from '@/utils/api';

interface Match {
  id: string;
  otherUser: {
    id: string;
    name: string;
  };
  otherPet: {
    id: string;
    name: string;
    breed: string;
    age: number;
    photoUrl: string;
  };
  createdAt: string;
}

export default function MatchesScreen() {
  const { user, loading: authLoading } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    console.log('MatchesScreen: Component mounted');
    loadMatches();
  }, []);

  const loadMatches = async () => {
    console.log('MatchesScreen: Loading user matches');
    try {
      setLoading(true);
      const response = await authenticatedGet<Match[]>('/api/matches');
      setMatches(response);
      console.log('MatchesScreen: Loaded', response.length, 'matches');
    } catch (error) {
      console.error('MatchesScreen: Error loading matches:', error);
      const mockMatches: Match[] = [
        {
          id: '1',
          otherUser: {
            id: 'user-1',
            name: 'Sarah Johnson',
          },
          otherPet: {
            id: 'pet-1',
            name: 'Buddy',
            breed: 'Golden Retriever',
            age: 3,
            photoUrl: 'https://images.unsplash.com/photo-1633722715463-d30f4f325e24?w=400',
          },
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          otherUser: {
            id: 'user-2',
            name: 'Mike Chen',
          },
          otherPet: {
            id: 'pet-2',
            name: 'Luna',
            breed: 'Siamese Cat',
            age: 2,
            photoUrl: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400',
          },
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: '3',
          otherUser: {
            id: 'user-3',
            name: 'Emma Davis',
          },
          otherPet: {
            id: 'pet-3',
            name: 'Max',
            breed: 'Corgi',
            age: 4,
            photoUrl: 'https://images.unsplash.com/photo-1612536981610-2e8a36a0e5f1?w=400',
          },
          createdAt: new Date(Date.now() - 172800000).toISOString(),
        },
      ];
      setMatches(mockMatches);
    } finally {
      setLoading(false);
    }
  };

  const formatMatchTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return 'Just now';
    }
    if (diffHours < 24) {
      const hoursText = diffHours === 1 ? 'hour' : 'hours';
      return `${diffHours} ${hoursText} ago`;
    }
    if (diffDays < 7) {
      const daysText = diffDays === 1 ? 'day' : 'days';
      return `${diffDays} ${daysText} ago`;
    }
    return date.toLocaleDateString();
  };

  const handleChatPress = (matchId: string) => {
    console.log('MatchesScreen: Opening chat for match', matchId);
    router.push(`/chat/${matchId}`);
  };

  if (authLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    console.log('MatchesScreen: No user found, redirecting to auth');
    return <Redirect href="/auth" />;
  }

  const renderMatch = ({ item }: { item: Match }) => {
    const matchTime = formatMatchTime(item.createdAt);
    const petAge = item.otherPet.age.toString();

    return (
      <View style={styles.matchCard}>
        <Image source={{ uri: item.otherPet.photoUrl }} style={styles.matchImage} />
        <View style={styles.matchBadge}>
          <IconSymbol
            ios_icon_name="heart.fill"
            android_material_icon_name="favorite"
            size={16}
            color="#FFFFFF"
          />
        </View>
        <View style={styles.matchInfo}>
          <Text style={styles.matchName}>{item.otherPet.name}</Text>
          <View style={styles.matchDetails}>
            <Text style={styles.matchAge}>{petAge}</Text>
            <Text style={styles.matchSeparator}>•</Text>
            <Text style={styles.matchBreed}>{item.otherPet.breed}</Text>
          </View>
          <Text style={styles.matchTime}>{matchTime}</Text>
          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => handleChatPress(item.id)}
          >
            <IconSymbol
              ios_icon_name="message.fill"
              android_material_icon_name="message"
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.chatButtonText}>Chat</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <IconSymbol
        ios_icon_name="heart"
        android_material_icon_name="favorite-border"
        size={80}
        color={colors.textLight}
      />
      <Text style={styles.emptyTitle}>No matches yet</Text>
      <Text style={styles.emptySubtitle}>
        Start swiping to find your pet&apos;s perfect match!
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Matches',
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
          <Text style={styles.loadingText}>Loading matches...</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          renderItem={renderMatch}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={[
            styles.listContent,
            matches.length === 0 && styles.emptyListContent,
          ]}
          numColumns={2}
          columnWrapperStyle={matches.length > 0 ? styles.columnWrapper : undefined}
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
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 100,
  },
  emptyListContent: {
    flex: 1,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  matchCard: {
    flex: 1,
    margin: 6,
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  matchImage: {
    width: '100%',
    aspectRatio: 1,
  },
  matchBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchInfo: {
    padding: 12,
  },
  matchName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  matchDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  matchAge: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  matchSeparator: {
    fontSize: 14,
    color: colors.textSecondary,
    marginHorizontal: 6,
  },
  matchBreed: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  matchTime: {
    fontSize: 12,
    color: colors.textLight,
    marginBottom: 8,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
