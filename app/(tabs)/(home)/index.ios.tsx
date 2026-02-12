
import { Stack, useRouter, Redirect } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { SafeAreaView } from 'react-native-safe-area-context';
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
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet, authenticatedPost } from '@/utils/api';
import React, { useState, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;
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
  streamId?: string;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const position = useRef(new Animated.ValueXY()).current;
  const swipeAnimation = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loadPets();
    loadStories();
  }, []);

  const loadPets = async () => {
    try {
      console.log('[Home] Loading pets for discovery');
      const data = await apiGet('/api/pets');
      setPets(data);
      console.log('[Home] Loaded pets:', data.length);
    } catch (error) {
      console.error('[Home] Failed to load pets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStories = async () => {
    try {
      console.log('[Home] Loading featured pets');
      const data = await apiGet('/api/featured-pets');
      setStories(data);
      console.log('[Home] Loaded featured pets:', data.length);
    } catch (error) {
      console.error('[Home] Failed to load featured pets:', error);
    }
  };

  const handleSwipe = async (swipeType: 'like' | 'pass') => {
    if (currentIndex >= pets.length) return;

    const currentPet = pets[currentIndex];
    
    try {
      console.log(`[Home] Swiping ${swipeType} on pet:`, currentPet.id);
      
      // Trigger haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Send swipe to backend
      const response = await authenticatedPost('/api/swipes', {
        swipedPetId: currentPet.id,
        swipeType,
      });

      // Check for match
      if (response.match) {
        console.log('[Home] Match detected!');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        alert("Pawsome! It's a Match! 🎉");
      }

      // Move to next card
      setCurrentIndex(prev => prev + 1);
      position.setValue({ x: 0, y: 0 });
    } catch (error) {
      console.error('[Home] Failed to swipe:', error);
    }
  };

  const handleButtonPress = (swipeType: 'like' | 'pass') => {
    const toValue = swipeType === 'like' ? CARD_WIDTH * 2 : -CARD_WIDTH * 2;
    
    Animated.timing(position, {
      toValue: { x: toValue, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => {
      handleSwipe(swipeType);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          // Swipe right (like)
          Animated.spring(position, {
            toValue: { x: CARD_WIDTH * 2, y: gesture.dy },
            useNativeDriver: false,
          }).start(() => handleSwipe('like'));
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          // Swipe left (pass)
          Animated.spring(position, {
            toValue: { x: -CARD_WIDTH * 2, y: gesture.dy },
            useNativeDriver: false,
          }).start(() => handleSwipe('pass'));
        } else {
          // Return to center
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  if (!user) {
    return <Redirect href="/auth" />;
  }

  const rotate = position.x.interpolate({
    inputRange: [-CARD_WIDTH, 0, CARD_WIDTH],
    outputRange: ['-10deg', '0deg', '10deg'],
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const passOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const currentPet = pets[currentIndex];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>PawPaw</Text>
      </View>

      {/* Stories Section */}
      {stories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.storiesContainer}
          contentContainerStyle={styles.storiesContent}
        >
          {stories.map((story) => {
            const storyNameText = story.name;
            return (
              <TouchableOpacity
                key={story.id}
                style={styles.storyItem}
                onPress={() => {
                  if (story.isLive && story.streamId) {
                    router.push(`/live/${story.streamId}`);
                  }
                }}
              >
                <View style={[styles.storyImageContainer, story.isLive && styles.liveStoryBorder]}>
                  <Image source={{ uri: story.photoUrl }} style={styles.storyImage} />
                  {story.isLive && (
                    <View style={styles.liveBadge}>
                      <Text style={styles.liveText}>LIVE</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.storyName} numberOfLines={1}>
                  {storyNameText}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Swipe Cards */}
      <View style={styles.cardContainer}>
        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading pets...</Text>
          </View>
        ) : currentPet ? (
          <>
            {/* Next card (behind) */}
            {pets[currentIndex + 1] && (
              <View style={[styles.card, styles.nextCard]}>
                <Image
                  source={{ uri: pets[currentIndex + 1].photoUrl }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
              </View>
            )}

            {/* Current card */}
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
              <Image
                source={{ uri: currentPet.photoUrl }}
                style={styles.cardImage}
                resizeMode="cover"
              />
              
              {/* Like Overlay */}
              <Animated.View style={[styles.overlay, styles.likeOverlay, { opacity: likeOpacity }]}>
                <Text style={styles.overlayText}>LIKE</Text>
              </Animated.View>

              {/* Pass Overlay */}
              <Animated.View style={[styles.overlay, styles.passOverlay, { opacity: passOpacity }]}>
                <Text style={styles.overlayText}>PASS</Text>
              </Animated.View>

              {/* Pet Info */}
              <View style={styles.cardInfo}>
                <Text style={styles.petName}>{currentPet.name}</Text>
                <Text style={styles.petDetails}>
                  {currentPet.breed}
                </Text>
                <Text style={styles.petDetails}>
                  {currentPet.age}
                </Text>
                {currentPet.bio && (
                  <Text style={styles.petBio} numberOfLines={2}>
                    {currentPet.bio}
                  </Text>
                )}
              </View>
            </Animated.View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <IconSymbol
              ios_icon_name="pawprint.fill"
              android_material_icon_name="pets"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyText}>No more pets to discover</Text>
            <TouchableOpacity onPress={loadPets} style={styles.reloadButton}>
              <Text style={styles.reloadButtonText}>Reload</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      {currentPet && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.passButton]}
            onPress={() => handleButtonPress('pass')}
          >
            <IconSymbol
              ios_icon_name="xmark"
              android_material_icon_name="close"
              size={32}
              color="#FF6B6B"
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
              color="#FF6B6B"
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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
  },
  storiesContainer: {
    maxHeight: 100,
    marginBottom: 16,
  },
  storiesContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  storyItem: {
    alignItems: 'center',
    width: 70,
  },
  storyImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2,
    backgroundColor: colors.card,
    marginBottom: 4,
  },
  liveStoryBorder: {
    borderWidth: 3,
    borderColor: '#FF0000',
  },
  storyImage: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  liveBadge: {
    position: 'absolute',
    bottom: -2,
    alignSelf: 'center',
    backgroundColor: '#FF0000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  liveText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  storyName: {
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.4,
    borderRadius: 20,
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
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
    padding: 20,
    borderWidth: 4,
    borderRadius: 12,
  },
  likeOverlay: {
    right: 50,
    borderColor: '#4CAF50',
    transform: [{ rotate: '20deg' }],
  },
  passOverlay: {
    left: 50,
    borderColor: '#FF6B6B',
    transform: [{ rotate: '-20deg' }],
  },
  overlayText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  cardInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  petName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  petDetails: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 2,
  },
  petBio: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
  },
  actions: {
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
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  passButton: {
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  likeButton: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 20,
  },
  reloadButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  reloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
