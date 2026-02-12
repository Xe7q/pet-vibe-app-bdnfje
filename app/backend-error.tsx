
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Stack, useRouter } from "expo-router";
import { colors } from "@/styles/commonStyles";

export default function BackendErrorScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: "Backend Issue", headerShown: true }} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.content}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Backend Connection Issue</Text>
          <Text style={styles.message}>
            The PawPaw backend is currently unavailable. This happens when the backend sandbox has been merged or is being rebuilt.
          </Text>
          
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>What&apos;s happening:</Text>
            <Text style={styles.infoText}>
              • The backend URL is pointing to an inactive sandbox{"\n"}
              • Authentication and data features are temporarily unavailable{"\n"}
              • The backend needs to be recreated
            </Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>To fix this:</Text>
            <Text style={styles.infoText}>
              1. Contact the Natively support team{"\n"}
              2. Request a new backend sandbox{"\n"}
              3. The backend will be automatically rebuilt with all features
            </Text>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 16,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  infoBox: {
    width: "100%",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 22,
  },
  button: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
