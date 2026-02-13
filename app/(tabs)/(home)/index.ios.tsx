
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
} from 'react-native';
import { Stack, useRouter, Redirect } from 'expo-router';
import { apiGet, authenticatedPost } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

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

const CARD_WIDTH = Dimensions.get('window').width - 40;
const SWIPE_THRESHOLD = 120;

export default function HomeScreen() {
  const router = useRouter();
  const { user, backendError, backendErrorMessage } = useAuth();
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [localBackendError, setLocalBackendError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const position = useRef(new Animated.ValueXY()).current;

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
    console.log('[Home iOS] Component mounted, loading data...');
    loadPets();
    loadStories();
  }, []);

  const loadPets = async () => {
    try {
      console.log('[Home iOS] Fetching pets...');
      const response = await apiGet('/api/pets');
      console.log('[Home iOS] Pets loaded:', response);
      setPets(response || []);
      setLocalBackendError(false);
    } catch (error: any) {
      console.error('[Home iOS] Failed to load pets:', error);
      if (error?.error === 'merged' || error?.message?.includes('merged')) {
        console.log('[Home iOS] Backend is merged/inactive');
        setLocalBackendError(true);
        setErrorMessage('Backend is currently unavailable. The sandbox has been merged and needs to be recreated.');
      } else {
        setErrorMessage('Failed to load pets. Please try again.');
      }
      setPets([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStories = async () => {
    try {
      console.log('[Home iOS] Fetching featured pets...');
      const response = await apiGet('/api/featured-pets');
      console.log('[Home iOS] Featured pets loaded:', response);
      setStories(response || []);
    } catch (error) {
      console.error('[Home iOS] Failed to load featured pets:', error);
      setStories([]);
    }
  };

  const handleSwipe = async (swipeType: 'like' | 'pass') => {
    if (currentIndex >= pets.length) {
      console.log('[Home iOS] No more pets to swipe');
      return;
    }

    const currentPet = pets[currentIndex];
    console.log(`[Home iOS] Swiping ${swipeType} on pet:`, currentPet.name);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.timing(position, {
      toValue: { x: swipeType === 'like' ? 500 : -500, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      position.setValue({ x: 0, y: 0 });
      setCurrentIndex(currentIndex + 1);
    });

    try {
      console.log(`[Home iOS] Recording ${swipeType} swipe for pet:`, currentPet.id);
      const response = await authenticatedPost('/api/swipes', {
        likedPetId: currentPet.id,
        swipeType,
      });
      console.log('[Home iOS] Swipe response:', response);

      if (response.match) {
        console.log('[Home iOS] It\'s a match!');
        // Show match notification
      }
    } catch (error) {
      console.error('[Home iOS] Failed to record swipe:', error);
    }
  };

  const handleButtonPress = (swipeType: 'like' | 'pass') => {
    console.log(`[Home iOS] Button pressed: ${swipeType}`);
    handleSwipe(swipeType);
  };

  if (!user) {
    console.log('[Home iOS] User not authenticated, redirecting to auth');
    return <Redirect href="/auth" />;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading pets...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show backend error if detected (either from AuthContext or local API calls)
  if (backendError || localBackendError) {
    const displayMessage = backendErrorMessage || errorMessage;
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Backend Unavailable</Text>
          <Text style={styles.errorText}>{displayMessage}</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => router.push('/backend-error')}
          >
            <Text style={styles.errorButtonText}>Learn More</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.errorButton, styles.retryButton]}
            onPress={() => {
              setLoading(true);
              loadPets();
              loadStories();
            }}
          >
            <Text style={styles.errorButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentPet = pets[currentIndex];
  const petName = currentPet?.name || '';
  const petBreed = currentPet?.breed || '';
  const petAge = currentPet?.age?.toString() || '';
  const petBio = currentPet?.bio || '';

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Stories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.storiesContainer}
        contentContainerStyle={styles.storiesContent}
      >
        {stories.map((story) => {
          const storyName = story.name;
          const isLive = story.isLive || false;
          return (
            <TouchableOpacity
              key={story.id}
              style={styles.storyItem}
              onPress={() => {
                if (isLive && story.streamId) {
                  console.log('[Home iOS] Navigating to live stream:', story.streamId);
                  router.push(`/live/${story.streamId}`);
                }
              }}
            >
              <View style={[styles.storyCircle, isLive && styles.liveStoryCircle]}>
                <Image source={{ uri: story.photoUrl }} style={styles.storyImage} />
              </View>
              <Text style={styles.storyName}>{storyName}</Text>
              {isLive && <Text style={styles.liveIndicator}>LIVE</Text>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Swipe Cards */}
      <View style={styles.cardsContainer}>
        {currentIndex < pets.length ? (
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.card,
              {
                transform: [
                  { translateX: position.x },
                  { translateY: position.y },
                  {
                    rotate: position.x.interpolate({
                      inputRange: [-CARD_WIDTH / 2, 0, CARD_WIDTH / 2],
                      outputRange: ['-10deg', '0deg', '10deg'],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          >
            <Image source={{ uri: currentPet.photoUrl }} style={styles.cardImage} />
            <View style={styles.cardInfo}>
              <Text style={styles.petName}>{petName}</Text>
              <Text style={styles.petBreed}>{petBreed}</Text>
              <Text style={styles.petAge}>{petAge}</Text>
              <Text style={styles.petBio}>{petBio}</Text>
            </View>
          </Animated.View>
        ) : (
          <View style={styles.noMorePets}>
            <Text style={styles.noMorePetsText}>No more pets to swipe!</Text>
            <TouchableOpacity
              style={styles.reloadButton}
              onPress={() => {
                console.log('[Home iOS] Reloading pets...');
                setCurrentIndex(0);
                loadPets();
              }}
            >
              <Text style={styles.reloadButtonText}>Reload</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Action Buttons - iOS specific positioning */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.passButton]}
          onPress={() => handleButtonPress('pass')}
        >
          <IconSymbol
            ios_icon_name="xmark"
            android_material_icon_name="close"
            size={32}
            color="#fff"
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
            color="#fff"
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  errorButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#666',
  },
  storiesContainer: {
    maxHeight: 120,
    marginBottom: 16,
  },
  storiesContent: {
    paddingHorizontal: 16,
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 16,
  },
  storyCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: '#ddd',
    padding: 3,
  },
  liveStoryCircle: {
    borderColor: colors.primary,
  },
  storyImage: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },
  storyName: {
    marginTop: 4,
    fontSize: 12,
    color: '#000',
  },
  liveIndicator: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: 'bold',
  },
  cardsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.4,
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '70%',
  },
  cardInfo: {
    padding: 16,
  },
  petName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  petBreed: {
    fontSize: 16,
    color: '#666',
    marginBottom: 2,
  },
  petAge: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  petBio: {
    fontSize: 14,
    color: '#666',
  },
  noMorePets: {
    alignItems: 'center',
  },
  noMorePetsText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 16,
  },
  reloadButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  reloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingBottom: 100,
    gap: 40,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  passButton: {
    backgroundColor: '#FF6B6B',
  },
  likeButton: {
    backgroundColor: '#4ECDC4',
  },
});
