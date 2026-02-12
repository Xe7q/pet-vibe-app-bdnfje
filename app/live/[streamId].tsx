
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet, authenticatedPost } from '@/utils/api';

const { width, height } = Dimensions.get('window');

interface LiveStream {
  id: string;
  pet: {
    id: string;
    name: string;
    photoUrl: string;
  };
  ownerId: string;
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
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const cameraRef = useRef<CameraView>(null);

  const loadStreamData = useCallback(async () => {
    try {
      console.log('[LiveStream] Loading stream data for:', streamId);
      const data = await apiGet(`/api/live/${streamId}`);
      setStream(data);
      console.log('[LiveStream] Stream loaded:', data);
      
      // If user is the owner, activate camera
      if (user?.id === data.ownerId) {
        console.log('[LiveStream] User is stream owner, activating camera');
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error('[LiveStream] Failed to load stream:', error);
    } finally {
      setLoading(false);
    }
  }, [streamId, user?.id]);

  const joinStream = useCallback(async () => {
    try {
      await authenticatedPost(`/api/live/${streamId}/join`, {});
      console.log('[LiveStream] Joined stream');
    } catch (error) {
      console.error('[LiveStream] Failed to join stream:', error);
    }
  }, [streamId]);

  const leaveStream = useCallback(async () => {
    try {
      await authenticatedPost(`/api/live/${streamId}/leave`, {});
      console.log('[LiveStream] Left stream');
    } catch (error) {
      console.error('[LiveStream] Failed to leave stream:', error);
    }
  }, [streamId]);

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
  }, [streamId, loadStreamData, joinStream, leaveStream]);

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
      Alert.alert('Insufficient Balance', 'You do not have enough Kibble to send this gift.');
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
      
      // Show success message
      Alert.alert('Gift Sent!', `🎉 You sent a ${giftType}! 🎉`);
      
      setShowGiftModal(false);
    } catch (error) {
      console.error('[LiveStream] Failed to send gift:', error);
      Alert.alert('Error', 'Failed to send gift. Please try again.');
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

  const handleEndStreamConfirm = () => {
    setShowEndConfirmModal(true);
  };

  const handleEndStream = async () => {
    if (!stream) return;
    
    setShowEndConfirmModal(false);
    setEndingStream(true);
    try {
      console.log('[LiveStream] Ending stream');
      await authenticatedPost(`/api/live/end/${streamId}`, {});
      
      Alert.alert('Stream Ended', 'Your live stream has ended successfully!');
      router.back();
    } catch (error) {
      console.error('[LiveStream] Failed to end stream:', error);
      Alert.alert('Error', 'Failed to end stream. Please try again.');
      setEndingStream(false);
    }
  };

  const toggleCameraType = () => {
    setCameraType(current => (current === 'back' ? 'front' : 'back'));
  };

  const requestCameraPermission = async () => {
    if (!permission) return;
    
    if (!permission.granted) {
      const result = await requestPermission();
      if (result.granted) {
        setIsCameraActive(true);
      } else {
        Alert.alert('Camera Permission', 'Camera permission is required to go live.');
      }
    } else {
      setIsCameraActive(true);
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

  const isOwner = user?.id === stream.ownerId;
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
        {/* Video/Camera Container */}
        {isOwner && isCameraActive && permission?.granted ? (
          <CameraView
            ref={cameraRef}
            style={styles.videoContainer}
            facing={cameraType}
          />
        ) : (
          <Image
            source={{ uri: stream.pet.photoUrl }}
            style={styles.videoContainer}
            resizeMode="cover"
          />
        )}
        
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

          {/* Camera Controls (only for stream owner) */}
          {isOwner && (
            <View style={styles.cameraControls}>
              {!isCameraActive ? (
                <TouchableOpacity
                  onPress={requestCameraPermission}
                  style={styles.cameraButton}
                >
                  <IconSymbol
                    ios_icon_name="video.fill"
                    android_material_icon_name="videocam"
                    size={24}
                    color="#fff"
                  />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={toggleCameraType}
                  style={styles.cameraButton}
                >
                  <IconSymbol
                    ios_icon_name="arrow.triangle.2.circlepath.camera"
                    android_material_icon_name="flip-camera-android"
                    size={24}
                    color="#fff"
                  />
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                onPress={handleEndStreamConfirm}
                style={styles.endStreamButton}
                disabled={endingStream}
              >
                {endingStream ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.endStreamText}>End</Text>
                )}
              </TouchableOpacity>
            </View>
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

        {/* End Stream Confirmation Modal */}
        <Modal
          visible={showEndConfirmModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEndConfirmModal(false)}
        >
          <View style={styles.confirmModalOverlay}>
            <View style={styles.confirmModal}>
              <Text style={styles.confirmTitle}>End Live Stream?</Text>
              <Text style={styles.confirmMessage}>
                Are you sure you want to end this live stream? This action cannot be undone.
              </Text>
              <View style={styles.confirmButtons}>
                <TouchableOpacity
                  onPress={() => setShowEndConfirmModal(false)}
                  style={[styles.confirmButton, styles.cancelButton]}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleEndStream}
                  style={[styles.confirmButton, styles.endButton]}
                >
                  <Text style={styles.endButtonText}>End Stream</Text>
                </TouchableOpacity>
              </View>
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
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cameraButton: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
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
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  confirmMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  endButton: {
    backgroundColor: '#EF4444',
  },
  endButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
