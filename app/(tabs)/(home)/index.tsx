
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
  Platform,
} from 'react-native';
import { Stack, useRouter, Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';
import { apiGet, authenticatedPost } from '@/utils/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;

interface PetProfile {
  id: string;
  name: string;
  breed: string;
  age: number;
  bio?: string;
  photoUrl: string;
  likesCount: number;
}

interface StoryItem {
  id: string;
  name: string;
  photoUrl: string;
  isLive?: boolean;
}

export default function HomeScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stories, setStories] = useState<StoryItem[]>([]);
  
  const position = useRef(new Animated.ValueXY()).current;
  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [0, SCREEN_WIDTH / 4],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const nopeOpacity = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 4, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          handleSwipe('like');
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          handleSwipe('pass');
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    console.log('HomeScreen: Component mounted, user:', user?.id);
    loadPets();
    loadStories();
  }, []);

  const loadPets = async () => {
    console.log('HomeScreen: Loading pets from discovery feed');
    try {
      setLoading(true);
      const response = await apiGet<PetProfile[]>('/api/pets');
      setPets(response);
      console.log('HomeScreen: Loaded', response.length, 'pets');
    } catch (error) {
      console.error('HomeScreen: Error loading pets:', error);
      // Fallback to mock data if API fails
      const mockPets: PetProfile[] = [
        {
          id: '1',
          name: 'Buddy',
          breed: 'Golden Retriever',
          age: 3,
          photoUrl: 'https://images.unsplash.com/photo-1633722715463-d30f4f325e24?w=800',
          likesCount: 245,
        },
        {
          id: '2',
          name: 'Luna',
          breed: 'Siamese Cat',
          age: 2,
          photoUrl: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=800',
          likesCount: 189,
        },
        {
          id: '3',
          name: 'Max',
          breed: 'Corgi',
          age: 4,
          photoUrl: 'https://images.unsplash.com/photo-1612536981610-2e8a36a0e5f1?w=800',
          likesCount: 312,
        },
      ];
      setPets(mockPets);
    } finally {
      setLoading(false);
    }
  };

  const loadStories = async () => {
    console.log('HomeScreen: Loading featured pet stories');
    // TODO: Backend Integration - GET /api/stories for featured pets
    const mockStories: StoryItem[] = [
      {
        id: 'live',
        name: 'LIVE NOW',
        photoUrl: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=200',
        isLive: true,
      },
      {
        id: '1',
        name: 'Buddy',
        photoUrl: 'https://images.unsplash.com/photo-1633722715463-d30f4f325e24?w=200',
      },
      {
        id: '2',
        name: 'Luna',
        photoUrl: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=200',
      },
      {
        id: '3',
        name: 'Max',
        photoUrl: 'https://images.unsplash.com/photo-1612536981610-2e8a36a0e5f1?w=200',
      },
      {
        id: '4',
        name: 'Bella',
        photoUrl: 'https://images.unsplash.com/photo-1583511655826-05700d52f4d9?w=200',
      },
    ];
    setStories(mockStories);
  };

  const handleSwipe = async (swipeType: 'like' | 'pass') => {
    const currentPetId = pets[currentIndex]?.id;
    console.log('HomeScreen: User swiped', swipeType, 'on pet:', pets[currentIndex]?.name);
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const direction = swipeType === 'like' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
    
    Animated.timing(position, {
      toValue: { x: direction, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(async () => {
      position.setValue({ x: 0, y: 0 });
      setCurrentIndex(currentIndex + 1);
      
      // Record swipe on backend
      try {
        const response = await authenticatedPost<{
          success: boolean;
          match?: {
            matchId: string;
            otherPet: {
              id: string;
              name: string;
              breed: string;
              photoUrl: string;
            };
          };
        }>('/api/swipes', {
          swipedPetId: currentPetId,
          swipeType,
        });

        // Check if it's a match
        if (response.match) {
          console.log('HomeScreen: It\'s a match!', response.match.otherPet.name);
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          // Show match notification
          // TODO: Add match modal/notification UI
        }
      } catch (error) {
        console.error('HomeScreen: Error recording swipe:', error);
      }
    });
  };

  const handleButtonPress = (swipeType: 'like' | 'pass') => {
    handleSwipe(swipeType);
  };

  if (authLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    console.log('HomeScreen: No user found, redirecting to auth');
    return <Redirect href="/auth" />;
  }

  const currentPet = pets[currentIndex];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerStyle: { backgroundColor: colors.background },
          headerLeft: () => (
            <View style={styles.headerLeft}>
              <Text style={styles.logo}>PawPaw</Text>
              <IconSymbol
                ios_icon_name="pawprint.fill"
                android_material_icon_name="pets"
                size={24}
                color={colors.primary}
                style={styles.logoIcon}
              />
            </View>
          ),
          headerRight: () => (
            <TouchableOpacity style={styles.cameraButton}>
              <IconSymbol
                ios_icon_name="camera.fill"
                android_material_icon_name="camera"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Stories Row */}
      <View style={styles.storiesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesContent}
        >
          {stories.map((story) => (
            <TouchableOpacity key={story.id} style={styles.storyItem}>
              <View style={[styles.storyCircle, story.isLive && styles.liveStoryCircle]}>
                <Image source={{ uri: story.photoUrl }} style={styles.storyImage} />
              </View>
              {story.isLive && (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
              )}
              <Text style={styles.storyName} numberOfLines={1}>
                {story.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Swipe Cards */}
      <View style={styles.cardsContainer}>
        {loading ? (
          <View style={styles.centered}>
            <Text style={styles.loadingText}>Finding pets...</Text>
          </View>
        ) : currentIndex >= pets.length ? (
          <View style={styles.centered}>
            <IconSymbol
              ios_icon_name="pawprint.fill"
              android_material_icon_name="pets"
              size={64}
              color={colors.textLight}
            />
            <Text style={styles.emptyText}>No more pets to discover!</Text>
            <TouchableOpacity style={styles.reloadButton} onPress={loadPets}>
              <Text style={styles.reloadButtonText}>Reload</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Current Card */}
            <Animated.View
              {...panResponder.panHandlers}
              style={[
                styles.card,
                {
                  transform: [
                    { translateX: position.x },
                    { translateY: position.y },
                    { rotate },
                  ],
                },
              ]}
            >
              <Image source={{ uri: currentPet.photoUrl }} style={styles.cardImage} />
              
              {/* Like Overlay */}
              <Animated.View style={[styles.overlay, styles.likeOverlay, { opacity: likeOpacity }]}>
                <Text style={styles.overlayText}>LIKE</Text>
              </Animated.View>
              
              {/* Nope Overlay */}
              <Animated.View style={[styles.overlay, styles.nopeOverlay, { opacity: nopeOpacity }]}>
                <Text style={styles.overlayText}>NOPE</Text>
              </Animated.View>

              {/* Pet Info */}
              <View style={styles.cardInfo}>
                <View style={styles.cardInfoRow}>
                  <Text style={styles.petName}>{currentPet.name}</Text>
                  <Text style={styles.petAge}>{currentPet.age}</Text>
                </View>
                <Text style={styles.petBreed}>{currentPet.breed}</Text>
              </View>
            </Animated.View>

            {/* Next Card Preview */}
            {currentIndex + 1 < pets.length && (
              <View style={[styles.card, styles.nextCard]}>
                <Image source={{ uri: pets[currentIndex + 1].photoUrl }} style={styles.cardImage} />
              </View>
            )}
          </>
        )}
      </View>

      {/* Action Buttons */}
      {currentIndex < pets.length && !loading && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.nopeButton]}
            onPress={() => handleButtonPress('pass')}
          >
            <IconSymbol
              ios_icon_name="xmark"
              android_material_icon_name="close"
              size={32}
              color={colors.error}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.likeButton]}
            onPress={() => handleButtonPress('like')}
          >
            <IconSymbol
              ios_icon_name="heart.fill"
              android_material_icon_name="favorite"
              size={32}
              color={colors.success}
            />
          </TouchableOpacity>
        </View>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  logoIcon: {
    marginLeft: 4,
  },
  cameraButton: {
    marginRight: 16,
    padding: 8,
  },
  storiesContainer: {
    height: 100,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  storiesContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  storyItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 70,
  },
  storyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: colors.primary,
    padding: 2,
  },
  liveStoryCircle: {
    borderColor: colors.error,
  },
  storyImage: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  liveBadge: {
    position: 'absolute',
    top: 48,
    backgroundColor: colors.error,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  storyName: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cardsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_HEIGHT * 0.6,
    borderRadius: 20,
    backgroundColor: colors.card,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  nextCard: {
    position: 'absolute',
    opacity: 0.5,
    transform: [{ scale: 0.95 }],
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 50,
    padding: 16,
    borderWidth: 4,
    borderRadius: 12,
  },
  likeOverlay: {
    right: 30,
    borderColor: colors.success,
    transform: [{ rotate: '20deg' }],
  },
  nopeOverlay: {
    left: 30,
    borderColor: colors.error,
    transform: [{ rotate: '-20deg' }],
  },
  overlayText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cardInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  petName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginRight: 8,
  },
  petAge: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  petBreed: {
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 40,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  nopeButton: {
    borderWidth: 2,
    borderColor: colors.error,
  },
  likeButton: {
    borderWidth: 2,
    borderColor: colors.success,
  },
  loadingText: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  emptyText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 24,
  },
  reloadButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  reloadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
