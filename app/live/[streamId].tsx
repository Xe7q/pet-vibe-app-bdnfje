
import React, { useState, useEffect, useRef } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet, authenticatedPost } from '@/utils/api';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

interface LiveStream {
  id: string;
  pet: {
    id: string;
    name: string;
    photoUrl: string;
  };
  title: string;
  viewerCount: number;
  startedAt: string;
}

interface ChatMessage {
  id: string;
  username: string;
  message: string;
}

const GIFT_OPTIONS = [
  { type: 'bone', name: 'Bone', emoji: '🦴', cost: 10 },
  { type: 'toy', name: 'Toy', emoji: '🎾', cost: 50 },
  { type: 'steak', name: 'King Steak', emoji: '🥩', cost: 500 },
];

export default function LiveStreamScreen() {
  const { streamId } = useLocalSearchParams<{ streamId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  
  const [stream, setStream] = useState<LiveStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [balance, setBalance] = useState(0);
  const [sendingGift, setSendingGift] = useState(false);
  const [endingStream, setEndingStream] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadStreamData();
    joinStream();
    
    // Simulate chat messages for demo
    const interval = setInterval(() => {
      const demoMessages = [
        'So cute! 🥰',
        'What a good boy!',
        'Love this stream!',
        'Adorable! ❤️',
      ];
      const randomMsg = demoMessages[Math.floor(Math.random() * demoMessages.length)];
      const randomUser = `User${Math.floor(Math.random() * 100)}`;
      
      setChatMessages(prev => [
        ...prev.slice(-20), // Keep last 20 messages
        {
          id: Date.now().toString(),
          username: randomUser,
          message: randomMsg,
        },
      ]);
    }, 5000);

    return () => {
      clearInterval(interval);
      leaveStream();
    };
  }, [streamId]);

  const loadStreamData = async () => {
    try {
      console.log('[LiveStream] Loading stream data for:', streamId);
      const data = await apiGet(`/api/live/${streamId}`);
      setStream(data);
      console.log('[LiveStream] Stream loaded:', data);
    } catch (error) {
      console.error('[LiveStream] Failed to load stream:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinStream = async () => {
    try {
      await authenticatedPost(`/api/live/${streamId}/join`, {});
      console.log('[LiveStream] Joined stream');
    } catch (error) {
      console.error('[LiveStream] Failed to join stream:', error);
    }
  };

  const leaveStream = async () => {
    try {
      await authenticatedPost(`/api/live/${streamId}/leave`, {});
      console.log('[LiveStream] Left stream');
    } catch (error) {
      console.error('[LiveStream] Failed to leave stream:', error);
    }
  };

  const loadBalance = async () => {
    try {
      const wallet = await apiGet('/api/wallet');
      setBalance(wallet.balance);
    } catch (error) {
      console.error('[LiveStream] Failed to load balance:', error);
    }
  };

  const handleSendGift = async (giftType: string, cost: number) => {
    if (!stream || !user) return;
    
    if (balance < cost) {
      alert('Insufficient Kibble balance!');
      return;
    }

    setSendingGift(true);
    try {
      console.log('[LiveStream] Sending gift:', giftType);
      await authenticatedPost('/api/gifts', {
        receiverId: stream.pet.id,
        giftType,
      });
      
      // Trigger haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Update balance
      setBalance(prev => prev - cost);
      
      // Show confetti animation (simplified)
      alert(`🎉 Sent ${giftType}! 🎉`);
      
      setShowGiftModal(false);
    } catch (error) {
      console.error('[LiveStream] Failed to send gift:', error);
      alert('Failed to send gift. Please try again.');
    } finally {
      setSendingGift(false);
    }
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    
    setChatMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        username: user?.name || 'You',
        message: messageInput,
      },
    ]);
    
    setMessageInput('');
    
    // Auto-scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleEndStream = async () => {
    if (!stream) return;
    
    setEndingStream(true);
    try {
      console.log('[LiveStream] Ending stream');
      await authenticatedPost(`/api/live/end/${streamId}`, {});
      
      alert('Stream ended successfully!');
      router.back();
    } catch (error) {
      console.error('[LiveStream] Failed to end stream:', error);
      alert('Failed to end stream. Please try again.');
      setEndingStream(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!stream) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Stream not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const viewerCountText = stream.viewerCount.toString();
  const petNameText = stream.pet.name;
  const streamTitleText = stream.title;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View style={styles.container}>
        {/* Video Container (Mock) */}
        <Image
          source={{ uri: stream.pet.photoUrl }}
          style={styles.videoContainer}
          resizeMode="cover"
        />
        
        {/* Overlay Gradient */}
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.8)']}
          style={styles.overlayGradient}
        />

        {/* Top Bar */}
        <SafeAreaView style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={28}
              color="#fff"
            />
          </TouchableOpacity>
          
          <View style={styles.liveInfo}>
            <View style={styles.liveBadge}>
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <View style={styles.viewerBadge}>
              <IconSymbol
                ios_icon_name="eye.fill"
                android_material_icon_name="visibility"
                size={16}
                color="#fff"
              />
              <Text style={styles.viewerText}>{viewerCountText}</Text>
            </View>
          </View>

          {/* End Stream Button (only for stream owner) */}
          {user?.id === stream.pet.id && (
            <TouchableOpacity
              onPress={handleEndStream}
              style={styles.endStreamButton}
              disabled={endingStream}
            >
              {endingStream ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.endStreamText}>End</Text>
              )}
            </TouchableOpacity>
          )}
        </SafeAreaView>

        {/* Stream Info */}
        <View style={styles.streamInfo}>
          <Text style={styles.petName}>{petNameText}</Text>
          <Text style={styles.streamTitle}>{streamTitleText}</Text>
        </View>

        {/* Chat Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatContainer}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {chatMessages.map((msg) => {
            const usernameText = msg.username;
            const messageText = msg.message;
            return (
              <View key={msg.id} style={styles.chatMessage}>
                <Text style={styles.chatUsername}>{usernameText}</Text>
                <Text style={styles.chatText}>{messageText}</Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          <View style={styles.messageInputContainer}>
            <TextInput
              style={styles.messageInput}
              placeholder="Say something nice..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={messageInput}
              onChangeText={setMessageInput}
              onSubmitEditing={handleSendMessage}
              returnKeyType="send"
            />
            <TouchableOpacity onPress={handleSendMessage} style={styles.sendButton}>
              <IconSymbol
                ios_icon_name="paperplane.fill"
                android_material_icon_name="send"
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            onPress={() => {
              loadBalance();
              setShowGiftModal(true);
            }}
            style={styles.giftButton}
          >
            <Text style={styles.giftButtonText}>🎁</Text>
          </TouchableOpacity>
        </View>

        {/* Gift Modal */}
        <Modal
          visible={showGiftModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowGiftModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.giftModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Send a Gift</Text>
                <TouchableOpacity onPress={() => setShowGiftModal(false)}>
                  <IconSymbol
                    ios_icon_name="xmark"
                    android_material_icon_name="close"
                    size={24}
                    color={colors.text}
                  />
                </TouchableOpacity>
              </View>
              
              <View style={styles.balanceContainer}>
                <Text style={styles.balanceLabel}>Your Kibble Balance:</Text>
                <Text style={styles.balanceAmount}>{balance}</Text>
              </View>

              <View style={styles.giftOptions}>
                {GIFT_OPTIONS.map((gift) => {
                  const giftNameText = gift.name;
                  const giftEmojiText = gift.emoji;
                  const giftCostText = `${gift.cost} Kibble`;
                  
                  return (
                    <TouchableOpacity
                      key={gift.type}
                      style={[
                        styles.giftOption,
                        balance < gift.cost && styles.giftOptionDisabled,
                      ]}
                      onPress={() => handleSendGift(gift.type, gift.cost)}
                      disabled={sendingGift || balance < gift.cost}
                    >
                      <Text style={styles.giftEmoji}>{giftEmojiText}</Text>
                      <Text style={styles.giftName}>{giftNameText}</Text>
                      <Text style={styles.giftCost}>{giftCostText}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {sendingGift && (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />
              )}
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  videoContainer: {
    position: 'absolute',
    width: width,
    height: height,
  },
  overlayGradient: {
    position: 'absolute',
    width: width,
    height: height,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    gap: 8,
  },
  liveBadge: {
    backgroundColor: '#FF0000',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  viewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  viewerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  streamInfo: {
    position: 'absolute',
    top: 120,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  petName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  streamTitle: {
    color: '#fff',
    fontSize: 16,
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  chatContainer: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    maxHeight: 200,
    zIndex: 10,
  },
  chatContent: {
    paddingBottom: 8,
  },
  chatMessage: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 6,
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  chatUsername: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  chatText: {
    color: '#fff',
    fontSize: 14,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 32,
    backgroundColor: 'rgba(0,0,0,0.3)',
    gap: 12,
    zIndex: 10,
  },
  messageInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 24,
    paddingHorizontal: 16,
  },
  messageInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 10,
  },
  sendButton: {
    padding: 8,
  },
  giftButton: {
    width: 48,
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  giftButtonText: {
    fontSize: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  giftModal: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  balanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  balanceAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  giftOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  giftOption: {
    flex: 1,
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  giftOptionDisabled: {
    opacity: 0.4,
  },
  giftEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  giftName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  giftCost: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  endStreamButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  endStreamText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
</write file>

Now let me create a screen to start a live stream and update the tab layout to include the "Go Live" button:

<write file="app/live/start.tsx">
import React, { useState, useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedGet, authenticatedPost } from '@/utils/api';

interface PetProfile {
  id: string;
  name: string;
  breed: string;
  age: number;
  photoUrl: string;
}

export default function StartLiveScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [pet, setPet] = useState<PetProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    loadPetProfile();
  }, []);

  const loadPetProfile = async () => {
    try {
      console.log('[StartLive] Loading pet profile');
      const data = await authenticatedGet('/api/pets/my-pet');
      setPet(data);
      console.log('[StartLive] Pet profile loaded:', data);
    } catch (error) {
      console.error('[StartLive] Failed to load pet profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartLive = async () => {
    if (!pet || !title.trim()) {
      alert('Please enter a stream title');
      return;
    }

    setStarting(true);
    try {
      console.log('[StartLive] Starting live stream');
      const response = await authenticatedPost('/api/live/start', {
        petId: pet.id,
        title: title.trim(),
      });
      
      console.log('[StartLive] Live stream started:', response);
      
      // Navigate to the live stream
      router.replace(`/live/${response.streamId}`);
    } catch (error) {
      console.error('[StartLive] Failed to start live stream:', error);
      alert('Failed to start live stream. Please try again.');
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!pet) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Go Live',
            headerShown: true,
          }}
        />
        <View style={styles.noPetContainer}>
          <IconSymbol
            ios_icon_name="pawprint.fill"
            android_material_icon_name="pets"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={styles.noPetTitle}>No Pet Profile</Text>
          <Text style={styles.noPetText}>
            You need to create a pet profile before going live
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/profile/create-pet')}
            style={styles.createButton}
          >
            <Text style={styles.createButtonText}>Create Pet Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const petNameText = pet.name;
  const petBreedText = pet.breed;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Go Live',
          headerShown: true,
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: pet.photoUrl }}
            style={styles.previewImage}
            resizeMode="cover"
          />
          <View style={styles.previewOverlay}>
            <View style={styles.liveBadge}>
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>
        </View>

        <View style={styles.petInfo}>
          <Text style={styles.petName}>{petNameText}</Text>
          <Text style={styles.petBreed}>{petBreedText}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Stream Title</Text>
          <TextInput
            style={styles.input}
            placeholder="What's happening?"
            placeholderTextColor={colors.textSecondary}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
          <Text style={styles.hint}>
            Give your viewers a hint about what they'll see
          </Text>
        </View>

        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>Live Streaming Tips:</Text>
          <Text style={styles.tipText}>• Make sure you have good lighting</Text>
          <Text style={styles.tipText}>• Keep your pet in frame</Text>
          <Text style={styles.tipText}>• Interact with your viewers</Text>
          <Text style={styles.tipText}>• Have fun! 🎉</Text>
        </View>

        <TouchableOpacity
          onPress={handleStartLive}
          style={[styles.startButton, (!title.trim() || starting) && styles.startButtonDisabled]}
          disabled={!title.trim() || starting}
        >
          {starting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.startButtonText}>Start Live Stream</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
  },
  noPetContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noPetTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  noPetText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  previewContainer: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  liveBadge: {
    backgroundColor: '#FF0000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  petInfo: {
    marginBottom: 24,
  },
  petName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  petBreed: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
  },
  tips: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  startButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
</write file>

Now let me create the pet profile creation screen:

<write file="app/profile/create-pet.tsx">
import React, { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { authenticatedPost } from '@/utils/api';

export default function CreatePetScreen() {
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [photoUri, setPhotoUri] = useState('');
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string): Promise<string> => {
    try {
      console.log('[CreatePet] Uploading image');
      
      // Create form data
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      formData.append('image', {
        uri,
        name: filename,
        type,
      } as any);

      // Upload to backend
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/upload/image`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      console.log('[CreatePet] Image uploaded:', data.url);
      return data.url;
    } catch (error) {
      console.error('[CreatePet] Failed to upload image:', error);
      throw error;
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !breed.trim() || !age.trim() || !photoUri) {
      alert('Please fill in all required fields and add a photo');
      return;
    }

    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 30) {
      alert('Please enter a valid age (0-30)');
      return;
    }

    setCreating(true);
    try {
      // Upload image first
      setUploading(true);
      const photoUrl = await uploadImage(photoUri);
      setUploading(false);

      // Create pet profile
      console.log('[CreatePet] Creating pet profile');
      await authenticatedPost('/api/pets', {
        name: name.trim(),
        breed: breed.trim(),
        age: ageNum,
        bio: bio.trim() || undefined,
        photoUrl,
      });

      console.log('[CreatePet] Pet profile created successfully');
      alert('Pet profile created! 🎉');
      router.back();
    } catch (error) {
      console.error('[CreatePet] Failed to create pet profile:', error);
      alert('Failed to create pet profile. Please try again.');
    } finally {
      setCreating(false);
      setUploading(false);
    }
  };

  const isFormValid = name.trim() && breed.trim() && age.trim() && photoUri;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Create Pet Profile',
          headerShown: true,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Tell us about your pet</Text>
          <Text style={styles.subtitle}>
            Create a profile to start swiping and matching!
          </Text>

          {/* Photo Picker */}
          <TouchableOpacity onPress={pickImage} style={styles.photoPicker}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <IconSymbol
                  ios_icon_name="camera.fill"
                  android_material_icon_name="camera"
                  size={48}
                  color={colors.textSecondary}
                />
                <Text style={styles.photoPlaceholderText}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Form Fields */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Pet Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Max, Bella, Luna"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
                maxLength={50}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Breed *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Golden Retriever, Persian Cat"
                placeholderTextColor={colors.textSecondary}
                value={breed}
                onChangeText={setBreed}
                maxLength={50}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Age *</Text>
              <TextInput
                style={styles.input}
                placeholder="Age in years"
                placeholderTextColor={colors.textSecondary}
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Bio (Optional)</Text>
              <TextInput
                style={[styles.input, styles.bioInput]}
                placeholder="Tell us about your pet's personality..."
                placeholderTextColor={colors.textSecondary}
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={4}
                maxLength={200}
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={handleCreate}
            style={[styles.createButton, (!isFormValid || creating) && styles.createButtonDisabled]}
            disabled={!isFormValid || creating}
          >
            {creating ? (
              <View style={styles.creatingContainer}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.creatingText}>
                  {uploading ? 'Uploading photo...' : 'Creating profile...'}
                </Text>
              </View>
            ) : (
              <Text style={styles.createButtonText}>Create Profile</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  photoPicker: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignSelf: 'center',
    marginBottom: 32,
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  photoPlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
  },
  form: {
    marginBottom: 24,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  createButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  creatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  creatingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
</write file>

Now let me update the tab layout to add a "Go Live" button in the center:

<write file="app/(tabs)/_layout.tsx">
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
