
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
  Modal,
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
  const [errorModal, setErrorModal] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

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
      setErrorModal({
        visible: true,
        message: 'Please enter a stream title',
      });
      return;
    }

    setStarting(true);
    try {
      console.log('[StartLive] Starting live stream for pet:', pet.id, 'with title:', title.trim());
      const response = await authenticatedPost('/api/live/start', {
        petId: pet.id,
        title: title.trim(),
      });
      
      console.log('[StartLive] Live stream started successfully:', response);
      console.log('[StartLive] Navigating to stream:', response.streamId);
      
      // Navigate to the live stream
      router.replace(`/live/${response.streamId}`);
    } catch (error: any) {
      console.error('[StartLive] Failed to start live stream:', error);
      const errorMessage = error?.message || 'Failed to start live stream. Please try again.';
      console.error('[StartLive] Error message:', errorMessage);
      setErrorModal({
        visible: true,
        message: errorMessage,
      });
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

      {/* Error Modal */}
      <Modal
        visible={errorModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModal({ visible: false, message: '' })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.errorModal}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="error"
              size={48}
              color="#EF4444"
            />
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorMessage}>{errorModal.message}</Text>
            <TouchableOpacity
              onPress={() => setErrorModal({ visible: false, message: '' })}
              style={styles.errorButton}
            >
              <Text style={styles.errorButtonText}>OK</Text>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorModal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  errorButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
