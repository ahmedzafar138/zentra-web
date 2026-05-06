import { API_BASE_URL } from "@/lib/utils";

const API_URL = `${API_BASE_URL}/api/v1`;

// Utility functions for token management in localStorage
export const setTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
};

export const getTokens = () => {
  return {
    accessToken: localStorage.getItem("accessToken"),
    refreshToken: localStorage.getItem("refreshToken"),
  };
};

// Check authentication state and return user data if valid
export const checkAuthState = async (): Promise<{
  isAuthenticated: boolean;
  user?: any;
  tokens?: { accessToken: string; refreshToken: string };
}> => {
  console.log("🔍 checkAuthState: Starting");

  // Get tokens from Redux store instead of localStorage
  const { store } = await import("@/store/store");
  const authState = store.getState().auth;
  const { accessToken, refreshToken } = authState;

  console.log("🔍 checkAuthState: Tokens from Redux:", {
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
  });

  if (!accessToken || !refreshToken) {
    console.log("🔍 checkAuthState: No tokens found in Redux");
    return { isAuthenticated: false };
  }

  // Check if access token is expired
  if (isAccessTokenExpired(accessToken)) {
    console.log("🔍 checkAuthState: Access token expired, refreshing");
    // Try to refresh the token
    const refreshed = await refreshTokens();
    if (!refreshed) {
      console.log("🔍 checkAuthState: Refresh failed");
      clearTokens();
      return { isAuthenticated: false };
    }
    console.log("🔍 checkAuthState: Refresh successful, retrying");
    // Get new tokens after refresh
    const newTokens = getTokens();
    return checkAuthState(); // Retry with new tokens
  }

  try {
    console.log("🔍 checkAuthState: Making request to", `${API_URL}/auth/me`);
    // Verify the token by fetching user data
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log("🔍 checkAuthState: Response status:", response.status);

    if (!response.ok) {
      console.log("🔍 checkAuthState: Response not OK, clearing tokens");
      clearTokens();
      return { isAuthenticated: false };
    }

    const userData = await response.json();
    console.log("🔍 checkAuthState: Success, user data:", userData);
    return {
      isAuthenticated: true,
      user: {
        id: String(userData.id),
        email: userData.email,
        firstName: userData.first_name,
        lastName: userData.last_name,
      },
      tokens: { accessToken, refreshToken },
    };
  } catch (error) {
    console.log("🔍 checkAuthState: Error:", error);
    clearTokens();
    return { isAuthenticated: false };
  }
};

export const clearTokens = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
};

// Helper to check if access token is expired (JWT)
export const isAccessTokenExpired = (token: string | null): boolean => {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

// Helper to refresh tokens
export const refreshTokens = async (): Promise<boolean> => {
  // Get refresh token from Redux store
  const { store } = await import("@/store/store");
  const { refreshToken } = store.getState().auth;

  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      clearTokens();
      return false;
    }

    const data = await response.json();
    setTokens(data.access_token, data.refresh_token);

    // Update Redux store with new tokens
    const { updateTokens } = await import("@/store/slices/authSlice");
    store.dispatch(
      updateTokens({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      })
    );

    return true;
  } catch {
    clearTokens();
    return false;
  }
};

// Authenticated fetch wrapper
export const authenticatedFetch = async (
  url: string,
  options: RequestInit = {}
) => {
  // Get tokens from Redux store instead of localStorage
  const { store } = await import("@/store/store");
  let { accessToken } = store.getState().auth;

  console.log("step 1");
  // Check if access token is expired
  if (accessToken && isAccessTokenExpired(accessToken)) {
    // Try to refresh the token
    const refreshed = await refreshTokens();
    if (!refreshed) {
      throw new Error("Session expired");
    }
    accessToken = store.getState().auth.accessToken;
  }
  console.log("step 2");

  // Add authorization header
  const headers = {
    ...options.headers,
    Authorization: `Bearer ${accessToken}`,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });
  console.log("step 3");

  if (response.status === 401) {
    // Try to refresh token on 401
    const refreshed = await refreshTokens();
    if (!refreshed) {
      throw new Error("Session expired");
    }

    // Retry the request with new token
    const { store } = await import("@/store/store");
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${store.getState().auth.accessToken}`,
      },
    });
  }
  console.log("step 4");
  console.log("Response status:", response);
  return response;
};
