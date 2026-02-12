
import React, { useState, useEffect } from 'react';
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
import { Stack, useRouter, Redirect } from 'expo-router';
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
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [myPet, setMyPet] = useState<PetProfile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  useEffect(() => {
    console.log('ProfileScreen: Component mounted, user:', user?.id);
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    console.log('ProfileScreen: Loading user profile and pet');
    try {
      setLoading(true);
      
      // Load pet profile
      try {
        const petResponse = await authenticatedGet<PetProfile>('/api/pets/my-pet');
        setMyPet(petResponse);
        console.log('ProfileScreen: Pet profile loaded:', petResponse.name);
      } catch (error: any) {
        console.log('ProfileScreen: No pet profile found or error:', error.message);
        setMyPet(null);
      }
      
      // Load wallet
      try {
        const walletResponse = await authenticatedGet<Wallet>('/api/wallet');
        setWallet(walletResponse);
        console.log('ProfileScreen: Wallet loaded, balance:', walletResponse.balance);
      } catch (error: any) {
        console.error('ProfileScreen: Error loading wallet:', error.message);
        // Set default wallet if API fails
        setWallet({ balance: 100, totalEarned: 0 });
      }
      
      console.log('ProfileScreen: Profile loaded successfully');
    } catch (error) {
      console.error('ProfileScreen: Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    console.log('ProfileScreen: User initiated sign out');
    setShowSignOutModal(false);
    try {
      await signOut();
      console.log('ProfileScreen: Sign out successful');
    } catch (error) {
      console.error('ProfileScreen: Error signing out:', error);
    }
  };

  if (authLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    console.log('ProfileScreen: No user found, redirecting to auth');
    return <Redirect href="/auth" />;
  }

  const userName = user.name || user.email || 'User';

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
              style={styles.settingsButton}
              onPress={() => setShowSignOutModal(true)}
            >
              <IconSymbol
                ios_icon_name="gearshape.fill"
                android_material_icon_name="settings"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* User Info */}
        <View style={styles.userSection}>
          <View style={styles.userAvatar}>
            <IconSymbol
              ios_icon_name="person.fill"
              android_material_icon_name="person"
              size={40}
              color={colors.primary}
            />
          </View>
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>

        {/* Wallet */}
        {wallet && (
          <View style={styles.walletCard}>
            <View style={styles.walletHeader}>
              <IconSymbol
                ios_icon_name="dollarsign.circle.fill"
                android_material_icon_name="account-balance-wallet"
                size={24}
                color={colors.primary}
              />
              <Text style={styles.walletTitle}>Kibble Balance</Text>
            </View>
            <View style={styles.walletStats}>
              <View style={styles.walletStat}>
                <Text style={styles.walletStatValue}>{wallet.balance}</Text>
                <Text style={styles.walletStatLabel}>Current Balance</Text>
              </View>
              <View style={styles.walletDivider} />
              <View style={styles.walletStat}>
                <Text style={styles.walletStatValue}>{wallet.totalEarned}</Text>
                <Text style={styles.walletStatLabel}>Total Earned</Text>
              </View>
            </View>
          </View>
        )}

        {/* My Pet */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading your pet...</Text>
          </View>
        ) : myPet ? (
          <View style={styles.petCard}>
            <View style={styles.petCardHeader}>
              <Text style={styles.petCardTitle}>My Pet</Text>
              <TouchableOpacity style={styles.editButton}>
                <IconSymbol
                  ios_icon_name="pencil"
                  android_material_icon_name="edit"
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>
            <Image source={{ uri: myPet.photoUrl }} style={styles.petImage} />
            <View style={styles.petInfo}>
              <View style={styles.petNameRow}>
                <Text style={styles.petName}>{myPet.name}</Text>
                <Text style={styles.petAge}>{myPet.age}</Text>
              </View>
              <Text style={styles.petBreed}>{myPet.breed}</Text>
              {myPet.bio && <Text style={styles.petBio}>{myPet.bio}</Text>}
              <View style={styles.petStats}>
                <IconSymbol
                  ios_icon_name="heart.fill"
                  android_material_icon_name="favorite"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.petLikes}>{myPet.likesCount}</Text>
                <Text style={styles.petLikesLabel}>likes</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.noPetCard}>
            <IconSymbol
              ios_icon_name="pawprint"
              android_material_icon_name="pets"
              size={64}
              color={colors.textLight}
            />
            <Text style={styles.noPetTitle}>No pet profile yet</Text>
            <Text style={styles.noPetSubtitle}>Create a profile for your pet to start matching!</Text>
            <TouchableOpacity style={styles.createPetButton}>
              <Text style={styles.createPetButtonText}>Create Pet Profile</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Sign Out Modal */}
      <Modal
        visible={showSignOutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignOutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sign Out</Text>
            <Text style={styles.modalMessage}>Are you sure you want to sign out?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowSignOutModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleSignOut}
              >
                <Text style={styles.modalButtonTextConfirm}>Sign Out</Text>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButton: {
    marginRight: 16,
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  userSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: colors.backgroundSecondary,
  },
  userAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  walletCard: {
    margin: 16,
    padding: 20,
    backgroundColor: colors.card,
    borderRadius: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  walletTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 8,
  },
  walletStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  walletStat: {
    flex: 1,
    alignItems: 'center',
  },
  walletStatValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  walletStatLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  walletDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  petCard: {
    margin: 16,
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  petCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  petCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  editButton: {
    padding: 8,
  },
  petImage: {
    width: '100%',
    aspectRatio: 1,
  },
  petInfo: {
    padding: 16,
  },
  petNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  petName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginRight: 8,
  },
  petAge: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  petBreed: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  petBio: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
  },
  petStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  petLikes: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  petLikesLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  noPetCard: {
    margin: 16,
    padding: 40,
    backgroundColor: colors.card,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  noPetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  noPetSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  createPetButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  createPetButtonText: {
    color: '#FFFFFF',
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
    backgroundColor: colors.card,
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
  modalMessage: {
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
  modalButtonCancel: {
    backgroundColor: colors.backgroundSecondary,
  },
  modalButtonConfirm: {
    backgroundColor: colors.error,
  },
  modalButtonTextCancel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
