
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedGet, authenticatedPost, BACKEND_URL } from '@/utils/api';
import * as ImagePicker from 'expo-image-picker';

interface Message {
  id: string;
  senderId: string;
  content: string | null;
  imageUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

interface Conversation {
  id: string;
  matchId: string;
  otherUser: {
    id: string;
  };
  otherPet: {
    id: string;
    name: string;
    photoUrl: string;
  };
  createdAt: string;
}

export default function ChatScreen() {
  const { user, loading: authLoading } = useAuth();
  const { id: matchId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const flatListRef = useRef<FlatList>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    console.log('ChatScreen: Component mounted for match', matchId);
    loadConversation();

    return () => {
      if (wsRef.current) {
        console.log('ChatScreen: Closing WebSocket connection');
        wsRef.current.close();
      }
    };
  }, [matchId]);

  const loadConversation = async () => {
    console.log('ChatScreen: Loading conversation for match', matchId);
    try {
      setLoading(true);
      const convResponse = await authenticatedGet<Conversation>(
        `/api/conversations/${matchId}`
      );
      setConversation(convResponse);
      console.log('ChatScreen: Conversation loaded', convResponse.id);

      await loadMessages(convResponse.id);
      connectWebSocket(convResponse.id);
      markMessagesAsRead(convResponse.id);
    } catch (error) {
      console.error('ChatScreen: Error loading conversation:', error);
      showError('Failed to load conversation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    console.log('ChatScreen: Loading messages for conversation', conversationId);
    try {
      const messagesResponse = await authenticatedGet<Message[]>(
        `/api/conversations/${conversationId}/messages`
      );
      setMessages(messagesResponse);
      console.log('ChatScreen: Loaded', messagesResponse.length, 'messages');

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('ChatScreen: Error loading messages:', error);
    }
  };

  const connectWebSocket = (conversationId: string) => {
    const wsUrl = BACKEND_URL.replace('http', 'ws') + '/api/ws/chat';
    console.log('ChatScreen: Connecting to WebSocket', wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('ChatScreen: WebSocket connected');
      };

      ws.onmessage = (event) => {
        console.log('ChatScreen: WebSocket message received', event.data);
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'message' && data.data.conversationId === conversationId) {
            const newMessage: Message = {
              id: data.data.messageId,
              senderId: data.data.senderId,
              content: data.data.content,
              imageUrl: data.data.imageUrl,
              isRead: false,
              createdAt: data.data.createdAt,
            };
            setMessages((prev) => [...prev, newMessage]);
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
            markMessagesAsRead(conversationId);
          }
        } catch (error) {
          console.error('ChatScreen: Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('ChatScreen: WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('ChatScreen: WebSocket disconnected');
      };
    } catch (error) {
      console.error('ChatScreen: Error connecting WebSocket:', error);
    }
  };

  const markMessagesAsRead = async (conversationId: string) => {
    try {
      await authenticatedPost(`/api/conversations/${conversationId}/mark-read`, {});
      console.log('ChatScreen: Messages marked as read');
    } catch (error) {
      console.error('ChatScreen: Error marking messages as read:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !conversation) {
      return;
    }

    const messageContent = inputText.trim();
    console.log('ChatScreen: Sending message:', messageContent);

    try {
      setSending(true);
      setInputText('');

      const newMessage = await authenticatedPost<Message>(
        `/api/conversations/${conversation.id}/messages`,
        { content: messageContent }
      );

      setMessages((prev) => [...prev, newMessage]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      console.log('ChatScreen: Message sent successfully');
    } catch (error) {
      console.error('ChatScreen: Error sending message:', error);
      showError('Failed to send message. Please try again.');
      setInputText(messageContent);
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async () => {
    console.log('ChatScreen: Picking image');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadAndSendImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('ChatScreen: Error picking image:', error);
      showError('Failed to pick image. Please try again.');
    }
  };

  const uploadAndSendImage = async (uri: string) => {
    if (!conversation) return;

    console.log('ChatScreen: Uploading image:', uri);
    try {
      setSending(true);

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: `chat-image-${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);

      const uploadResponse = await fetch(`${BACKEND_URL}/api/upload/chat-image`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Image upload failed');
      }

      const uploadData = await uploadResponse.json();
      const imageUrl = uploadData.url;
      console.log('ChatScreen: Image uploaded:', imageUrl);

      const newMessage = await authenticatedPost<Message>(
        `/api/conversations/${conversation.id}/messages`,
        { imageUrl }
      );

      setMessages((prev) => [...prev, newMessage]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      console.log('ChatScreen: Image message sent successfully');
    } catch (error) {
      console.error('ChatScreen: Error uploading image:', error);
      showError('Failed to send image. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes < 1) {
        return 'Just now';
      }
      const minutesText = diffMinutes === 1 ? 'min' : 'mins';
      return `${diffMinutes} ${minutesText} ago`;
    }
    if (diffHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (authLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    console.log('ChatScreen: No user found, redirecting to auth');
    return <Redirect href="/auth" />;
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.senderId === user.id;
    const messageTime = formatMessageTime(item.createdAt);

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
        ]}
      >
        {item.imageUrl ? (
          <View
            style={[
              styles.imageMessageBubble,
              isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
            ]}
          >
            <Image source={{ uri: item.imageUrl }} style={styles.messageImage} />
          </View>
        ) : (
          <View
            style={[
              styles.messageBubble,
              isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isMyMessage ? styles.myMessageText : styles.otherMessageText,
              ]}
            >
              {item.content}
            </Text>
          </View>
        )}
        <Text
          style={[
            styles.messageTime,
            isMyMessage ? styles.myMessageTime : styles.otherMessageTime,
          ]}
        >
          {messageTime}
        </Text>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <IconSymbol
        ios_icon_name="message"
        android_material_icon_name="message"
        size={60}
        color={colors.textLight}
      />
      <Text style={styles.emptyText}>No messages yet</Text>
      <Text style={styles.emptySubtext}>Start the conversation!</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: conversation?.otherPet.name || 'Chat',
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: 'bold',
            color: colors.text,
          },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <IconSymbol
                ios_icon_name="chevron.left"
                android_material_icon_name="arrow-back"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
          ),
        }}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading chat...</Text>
        </View>
      ) : (
        <>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={[
              styles.messagesList,
              messages.length === 0 && styles.emptyListContent,
            ]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }}
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
            <View style={styles.inputContainer}>
              <TouchableOpacity
                style={styles.imageButton}
                onPress={handlePickImage}
                disabled={sending}
              >
                <IconSymbol
                  ios_icon_name="photo"
                  android_material_icon_name="image"
                  size={24}
                  color={colors.primary}
                />
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor={colors.textLight}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                editable={!sending}
              />

              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!inputText.trim() || sending) && styles.sendButtonDisabled,
                ]}
                onPress={handleSendMessage}
                disabled={!inputText.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <IconSymbol
                    ios_icon_name="paperplane.fill"
                    android_material_icon_name="send"
                    size={20}
                    color="#FFFFFF"
                  />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </>
      )}

      <Modal
        visible={errorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle"
              android_material_icon_name="error"
              size={48}
              color={colors.error}
            />
            <Text style={styles.modalTitle}>Error</Text>
            <Text style={styles.modalMessage}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  backButton: {
    padding: 8,
    marginLeft: 4,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyListContent: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '75%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  myMessageBubble: {
    backgroundColor: colors.primary,
  },
  otherMessageBubble: {
    backgroundColor: colors.card,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: colors.text,
  },
  imageMessageBubble: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    marginHorizontal: 4,
  },
  myMessageTime: {
    color: colors.textLight,
    textAlign: 'right',
  },
  otherMessageTime: {
    color: colors.textLight,
    textAlign: 'left',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  imageButton: {
    padding: 8,
    marginRight: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
