import {
  signUp,
  confirmSignUp,
  signIn,
  signOut,
  getCurrentUser,
  fetchAuthSession,
} from "aws-amplify/auth";
import { apiCache } from "./apiCache.js";

export class AuthService {
  static authCache = new Map();
  static AUTH_CACHE_KEY = "auth_session";
  static TOKEN_CACHE_KEY = "auth_token";

  static async signUp(email, password, firstName, lastName) {
    try {
      const { user } = await signUp({
        username: email,
        password,
        attributes: {
          email,
          given_name: firstName,
          family_name: lastName,
        },
      });
      return { success: true, user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async confirmSignUp(email, confirmationCode) {
    try {
      await confirmSignUp({
        username: email,
        confirmationCode,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async signIn(email, password) {
    try {
      // Clear auth cache on new sign in
      this.clearAuthCache();

      const { isSignedIn, nextStep } = await signIn({
        username: email,
        password,
      });
      return { success: true, isSignedIn, nextStep };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async signOut() {
    try {
      // Clear all auth caches on sign out
      this.clearAuthCache();
      apiCache.clear();

      await signOut();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async getCurrentUser() {
    try {
      const user = await getCurrentUser();
      return { success: true, user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async getAuthToken(useCache = true) {
    try {
      // Check cache first if enabled
      if (useCache && apiCache.has(this.TOKEN_CACHE_KEY)) {
        return apiCache.get(this.TOKEN_CACHE_KEY);
      }

      const session = await fetchAuthSession();
      const result = { success: true, token: session.tokens.idToken };

      // Cache the token for 4 minutes (tokens expire in 5 minutes)
      if (useCache && result.success) {
        apiCache.set(this.TOKEN_CACHE_KEY, result, 240000);
      }

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async getAuthSession(useCache = true) {
    try {
      // Check cache first if enabled
      if (useCache && apiCache.has(this.AUTH_CACHE_KEY)) {
        return apiCache.get(this.AUTH_CACHE_KEY);
      }

      const session = await fetchAuthSession();

      // Cache successful session for 4 minutes
      if (useCache && session?.tokens?.accessToken) {
        apiCache.set(this.AUTH_CACHE_KEY, session, 240000);
      }

      return session;
    } catch (error) {
      console.error("Auth session error:", error);
      throw error;
    }
  }

  static clearAuthCache() {
    apiCache.delete(this.AUTH_CACHE_KEY);
    apiCache.delete(this.TOKEN_CACHE_KEY);
  }

  static isTokenExpiringSoon(token) {
    if (!token?.payload?.exp) return true;

    const expirationTime = token.payload.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    const timeUntilExpiry = expirationTime - currentTime;

    // Consider token expiring if less than 1 minute remaining
    return timeUntilExpiry < 60000;
  }
}
