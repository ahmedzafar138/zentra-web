import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { login, logout } from "@/store/slices/authSlice";
import { checkAuthState } from "@/lib/auth";

const AuthInitializer = ({ children }: { children: React.ReactNode }) => {
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Only validate if Redux thinks user is authenticated
        if (isAuthenticated) {
          const authState = await checkAuthState();

          if (authState.isAuthenticated && authState.user && authState.tokens) {
            // Session is valid, update Redux with fresh data
            dispatch(
              login({
                accessToken: authState.tokens.accessToken,
                refreshToken: authState.tokens.refreshToken,
                user: authState.user,
              })
            );
          } else {
            // Session is invalid, clear Redux state
            console.log("Session validation failed, logging out");
            dispatch(logout());
          }
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
        // On network error, keep current state but validate on next API call
      }
    };

    initializeAuth();
  }, []); // Only run once on app startup

  return <>{children}</>;
};

export default AuthInitializer;
