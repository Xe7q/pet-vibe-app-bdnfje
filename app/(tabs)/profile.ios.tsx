
import React, { useState, useEffect } from 'react';
import { Stack, useRouter, Redirect } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedGet } from '@/utils/api';

interface PetProfile {
  id: string;
  name: string;
  breed: string;
  age: number;
  bio?: string;
  photoUrl: string;
  likesCount: number;
}

interface Wallet {
  balance: number;
  totalEarned: number;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  
  const [petProfile, setPetProfile] = useState<PetProfile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [signOutModalVisible, setSignOutModalVisible] = useState(false);

  useEffect(() => {
    if (user) {
      console.log('ProfileScreen: Component mounted, user:', user.id);
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    console.log('ProfileScreen: Loading user profile and pet');
    try {
      setLoading(true);
      
      // Load pet profile
      const pet = await authenticatedGet<PetProfile | null>('/api/pets/my-pet');
      setPetProfile(pet);
      console.log('ProfileScreen: Pet profile loaded:', pet ? pet.name : 'No pet');
      
      // Load wallet
      console.log('ProfileScreen: Loading wallet');
      const walletData = await authenticatedGet<Wallet>('/api/wallet');
      setWallet(walletData);
      console.log('ProfileScreen: Wallet loaded, balance:', walletData.balance);
      
      console.log('ProfileScreen: Profile loaded successfully');
    } catch (error: any) {
      console.error('ProfileScreen: Error loading profile:', error);
      console.error('ProfileScreen: Error message:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    console.log('ProfileScreen: Sign out requested');
    setSignOutModalVisible(false);
    try {
      await signOut();
      console.log('ProfileScreen: Sign out successful');
      router.replace('/auth');
    } catch (error) {
      console.error('ProfileScreen: Sign out error:', error);
    }
  };

  if (!user) {
    console.log('ProfileScreen: No user, redirecting to auth');
    return <Redirect href="/auth" />;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const userName = user.name || user.email || 'User';
  const balanceText = wallet ? wallet.balance.toString() : '0';
  const earningsText = wallet ? wallet.totalEarned.toString() : '0';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Profile',
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: 'bold',
            color: colors.text,
          },
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setSignOutModalVisible(true)}
              style={styles.signOutButton}
            >
              <IconSymbol
                ios_icon_name="rectangle.portrait.and.arrow.right"
                android_material_icon_name="logout"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* User Info */}
        <View style={styles.userSection}>
          <View style={styles.userAvatar}>
            {user.image ? (
              <Image source={{ uri: user.image }} style={styles.avatarImage} />
            ) : (
              <IconSymbol
                ios_icon_name="person.circle.fill"
                android_material_icon_name="account-circle"
                size={80}
                color={colors.primary}
              />
            )}
          </View>
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>

        {/* Pet Profile Section */}
        {petProfile ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Pet</Text>
            </View>
            <View style={styles.petCard}>
              <Image source={{ uri: petProfile.photoUrl }} style={styles.petImage} />
              <View style={styles.petInfo}>
                <Text style={styles.petName}>{petProfile.name}</Text>
                <Text style={styles.petBreed}>{petProfile.breed}</Text>
                <Text style={styles.petAge}>{petProfile.age}</Text>
                {petProfile.bio && (
                  <Text style={styles.petBio} numberOfLines={2}>
                    {petProfile.bio}
                  </Text>
                )}
                <View style={styles.petStats}>
                  <IconSymbol
                    ios_icon_name="heart.fill"
                    android_material_icon_name="favorite"
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={styles.petLikes}>{petProfile.likesCount}</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Pet</Text>
            <View style={styles.noPetCard}>
              <IconSymbol
                ios_icon_name="pawprint.fill"
                android_material_icon_name="pets"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={styles.noPetText}>No pet profile yet</Text>
              <TouchableOpacity
                onPress={() => router.push('/profile/create-pet')}
                style={styles.createPetButton}
              >
                <Text style={styles.createPetButtonText}>Create Pet Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Wallet Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kibble Wallet</Text>
          <View style={styles.walletCard}>
            <View style={styles.walletItem}>
              <Text style={styles.walletLabel}>Balance</Text>
              <Text style={styles.walletValue}>{balanceText}</Text>
            </View>
            <View style={styles.walletDivider} />
            <View style={styles.walletItem}>
              <Text style={styles.walletLabel}>Total Earned</Text>
              <Text style={styles.walletValue}>{earningsText}</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/live/start')}
          >
            <IconSymbol
              ios_icon_name="video.fill"
              android_material_icon_name="videocam"
              size={24}
              color={colors.primary}
            />
            <Text style={styles.actionButtonText}>Start Live Stream</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Sign Out Confirmation Modal */}
      <Modal
        visible={signOutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSignOutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sign Out</Text>
            <Text style={styles.modalText}>Are you sure you want to sign out?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setSignOutModalVisible(false)}
                style={[styles.modalButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSignOut}
                style={[styles.modalButton, styles.confirmButton]}
              >
                <Text style={styles.confirmButtonText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  signOutButton: {
    marginRight: 16,
  },
  userSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  userAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  petCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  petImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    marginRight: 16,
  },
  petInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  petName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  petBreed: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  petAge: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  petBio: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
  },
  petStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  petLikes: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  noPetCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  noPetText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 20,
  },
  createPetButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  createPetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  walletCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  walletItem: {
    flex: 1,
    alignItems: 'center',
  },
  walletDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  walletLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  walletValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 12,
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
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  modalText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.card,
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
