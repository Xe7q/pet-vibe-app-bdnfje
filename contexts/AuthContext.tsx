
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { authClient, setBearerToken, clearAuthTokens } from "@/lib/auth";

interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  backendError: boolean;
  backendErrorMessage: string;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function openOAuthPopup(provider: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const popupUrl = `${window.location.origin}/auth-popup?provider=${provider}`;
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      popupUrl,
      "oauth-popup",
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );

    if (!popup) {
      reject(new Error("Failed to open popup. Please allow popups."));
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "oauth-success" && event.data?.token) {
        window.removeEventListener("message", handleMessage);
        clearInterval(checkClosed);
        resolve(event.data.token);
      } else if (event.data?.type === "oauth-error") {
        window.removeEventListener("message", handleMessage);
        clearInterval(checkClosed);
        reject(new Error(event.data.error || "OAuth failed"));
      }
    };

    window.addEventListener("message", handleMessage);

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", handleMessage);
        reject(new Error("Authentication cancelled"));
      }
    }, 500);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState(false);
  const [backendErrorMessage, setBackendErrorMessage] = useState("");

  useEffect(() => {
    console.log("[AuthContext] Initializing, fetching user session...");
    fetchUser();

    // Listen for deep links (e.g. from social auth redirects)
    const subscription = Linking.addEventListener("url", (event) => {
      console.log("[AuthContext] Deep link received, refreshing user session");
      // Allow time for the client to process the token if needed
      setTimeout(() => fetchUser(), 500);
    });

    // POLLING: Refresh session every 5 minutes to keep SecureStore token in sync
    // This prevents 401 errors when the session token rotates
    const intervalId = setInterval(() => {
      console.log("[AuthContext] Auto-refreshing user session to sync token...");
      fetchUser();
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      subscription.remove();
      clearInterval(intervalId);
    };
  }, []);

  const fetchUser = async () => {
    try {
      setLoading(true);
      console.log("[AuthContext] Fetching session from Better Auth...");
      const session = await authClient.getSession();
      console.log("[AuthContext] Session response:", session);
      
      // Check for backend errors (merged branch, inactive sandbox, etc.)
      if (session?.error) {
        const errorMsg = session.error.message || session.error.error || "";
        const isMergedError = errorMsg.includes("merged") || errorMsg.includes("no longer has an active sandbox");
        
        if (isMergedError) {
          console.error("[AuthContext] Backend is merged/inactive:", errorMsg);
          setBackendError(true);
          setBackendErrorMessage("The backend sandbox has been merged and is no longer active. Please contact support to recreate the backend.");
          setUser(null);
          await clearAuthTokens();
          setLoading(false);
          return;
        }
      }
      
      if (session?.data?.user) {
        console.log("[AuthContext] User authenticated:", session.data.user.email);
        setUser(session.data.user as User);
        setBackendError(false);
        setBackendErrorMessage("");
        // Sync token to SecureStore for utils/api.ts
        if (session.data.session?.token) {
          console.log("[AuthContext] Syncing bearer token to storage");
          await setBearerToken(session.data.session.token);
        }
      } else {
        console.log("[AuthContext] No active session found");
        setUser(null);
        setBackendError(false);
        setBackendErrorMessage("");
        await clearAuthTokens();
      }
    } catch (error: any) {
      console.error("[AuthContext] Failed to fetch user:", error);
      
      // Check if the error is a backend connectivity issue
      const errorMsg = error?.message || error?.error || "";
      const isMergedError = errorMsg.includes("merged") || errorMsg.includes("no longer has an active sandbox");
      
      if (isMergedError) {
        console.error("[AuthContext] Backend is merged/inactive (catch block)");
        setBackendError(true);
        setBackendErrorMessage("The backend sandbox has been merged and is no longer active. Please contact support to recreate the backend.");
      } else {
        setBackendError(false);
        setBackendErrorMessage("");
      }
      
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      console.log("[AuthContext] Signing in with email:", email);
      const result = await authClient.signIn.email({ email, password });
      console.log("[AuthContext] Sign in result:", result);
      await fetchUser();
    } catch (error) {
      console.error("[AuthContext] Email sign in failed:", error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    try {
      console.log("[AuthContext] Signing up with email:", email);
      const result = await authClient.signUp.email({
        email,
        password,
        name,
      });
      console.log("[AuthContext] Sign up result:", result);
      await fetchUser();
    } catch (error) {
      console.error("[AuthContext] Email sign up failed:", error);
      throw error;
    }
  };

  const signInWithSocial = async (provider: "google" | "apple" | "github") => {
    try {
      console.log(`[AuthContext] Starting ${provider} OAuth flow`);
      if (Platform.OS === "web") {
        console.log(`[AuthContext] Opening ${provider} OAuth popup`);
        const token = await openOAuthPopup(provider);
        console.log(`[AuthContext] Received token from ${provider} popup`);
        await setBearerToken(token);
        await fetchUser();
      } else {
        // Native: Use expo-linking to generate a proper deep link
        const callbackURL = Linking.createURL("/");
        console.log(`[AuthContext] Starting ${provider} OAuth with callback:`, callbackURL);
        await authClient.signIn.social({
          provider,
          callbackURL,
        });
        // Note: The redirect will reload the app or be handled by deep linking.
        // fetchUser will be called on mount or via event listener if needed.
        console.log(`[AuthContext] ${provider} OAuth initiated, waiting for callback...`);
        await fetchUser();
      }
    } catch (error) {
      console.error(`[AuthContext] ${provider} sign in failed:`, error);
      throw error;
    }
  };

  const signInWithGoogle = () => signInWithSocial("google");
  const signInWithApple = () => signInWithSocial("apple");
  const signInWithGitHub = () => signInWithSocial("github");

  const signOut = async () => {
    try {
      console.log("[AuthContext] Signing out...");
      await authClient.signOut();
      console.log("[AuthContext] Sign out successful");
    } catch (error) {
      console.error("[AuthContext] Sign out failed (API):", error);
    } finally {
       // Always clear local state
       console.log("[AuthContext] Clearing local auth state");
       setUser(null);
       setBackendError(false);
       setBackendErrorMessage("");
       await clearAuthTokens();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        backendError,
        backendErrorMessage,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signInWithApple,
        signInWithGitHub,
        signOut,
        fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
