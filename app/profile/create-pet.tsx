
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
import { authenticatedPost, BACKEND_URL } from '@/utils/api';

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

      // Upload to backend using the correct endpoint
      const response = await fetch(`${BACKEND_URL}/api/upload/pet-photo`, {
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
