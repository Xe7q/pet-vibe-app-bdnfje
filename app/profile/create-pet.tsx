
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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { authenticatedPost, BACKEND_URL, getBearerToken } from '@/utils/api';

export default function CreatePetScreen() {
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [photoUri, setPhotoUri] = useState('');
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const showError = (message: string) => {
    console.error('[CreatePet] Error:', message);
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  const pickImage = async () => {
    console.log('[CreatePet] Opening image picker');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      console.log('[CreatePet] Image selected:', result.assets[0].uri);
      setPhotoUri(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string): Promise<string> => {
    try {
      console.log('[CreatePet] Starting image upload');
      console.log('[CreatePet] Image URI:', uri);
      
      // Get bearer token
      const token = await getBearerToken();
      if (!token) {
        throw new Error('Authentication token not found. Please sign in again.');
      }

      // Create form data
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      console.log('[CreatePet] Preparing file:', { filename, type, uri });
      
      // Append the file to FormData
      // @ts-expect-error - React Native FormData accepts this format
      formData.append('file', {
        uri: Platform.OS === 'web' ? uri : uri,
        name: filename,
        type,
      });

      // Upload to backend
      const uploadUrl = `${BACKEND_URL}/api/upload/pet-photo`;
      console.log('[CreatePet] Uploading to:', uploadUrl);
      console.log('[CreatePet] FormData prepared with field name: file');
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          // Don't set Content-Type - let the browser/RN set it with boundary
        },
      });

      console.log('[CreatePet] Upload response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[CreatePet] Upload failed with status:', response.status);
        console.error('[CreatePet] Error response:', errorText);
        throw new Error(`Upload failed: ${response.status}. ${errorText}`);
      }

      const data = await response.json();
      console.log('[CreatePet] Upload response data:', data);
      
      if (!data.url) {
        throw new Error('Upload succeeded but no URL returned');
      }
      
      console.log('[CreatePet] Image uploaded successfully:', data.url);
      return data.url;
    } catch (error: any) {
      console.error('[CreatePet] Upload error:', error);
      console.error('[CreatePet] Error details:', error.message);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  };

  const handleCreate = async () => {
    console.log('[CreatePet] Create button pressed');
    console.log('[CreatePet] Form data:', { name, breed, age, bio, hasPhoto: !!photoUri });
    
    if (!name.trim() || !breed.trim() || !age.trim() || !photoUri) {
      showError('Please fill in all required fields and add a photo');
      return;
    }

    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 30) {
      showError('Please enter a valid age (0-30)');
      return;
    }

    setCreating(true);
    try {
      // Upload image first
      console.log('[CreatePet] Step 1: Uploading image');
      setUploading(true);
      const photoUrl = await uploadImage(photoUri);
      setUploading(false);
      console.log('[CreatePet] Image upload complete, URL:', photoUrl);

      // Create pet profile
      console.log('[CreatePet] Step 2: Creating pet profile');
      const petData = {
        name: name.trim(),
        breed: breed.trim(),
        age: ageNum,
        bio: bio.trim() || undefined,
        photoUrl,
      };
      console.log('[CreatePet] Sending pet data:', petData);
      
      const response = await authenticatedPost('/api/pets', petData);
      console.log('[CreatePet] Pet profile created successfully:', response);
      
      setSuccessModalVisible(true);
      
      // Navigate back after a short delay
      setTimeout(() => {
        setSuccessModalVisible(false);
        router.back();
      }, 1500);
    } catch (error: any) {
      console.error('[CreatePet] Failed to create pet profile:', error);
      console.error('[CreatePet] Error message:', error.message);
      showError(error.message || 'Failed to create pet profile. Please try again.');
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

      {/* Error Modal */}
      <Modal
        visible={errorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="error"
              size={48}
              color="#FF6B6B"
            />
            <Text style={styles.modalTitle}>Upload Failed</Text>
            <Text style={styles.modalText}>{errorMessage}</Text>
            <TouchableOpacity
              onPress={() => setErrorModalVisible(false)}
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={64}
              color="#4CAF50"
            />
            <Text style={styles.modalTitle}>Success!</Text>
            <Text style={styles.modalText}>Pet profile created! 🎉</Text>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 32,
    width: '80%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  modalText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
