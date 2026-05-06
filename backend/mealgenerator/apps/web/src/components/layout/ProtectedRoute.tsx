import { Navigate } from "react-router-dom";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { useEffect, useState } from "react";
import { logout } from "@/store/slices/authSlice";
import { checkAuthState } from "@/lib/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, accessToken } = useAppSelector(
    (state) => state.auth
  );
  const dispatch = useAppDispatch();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const validateAuth = async () => {
      console.log("🛡️ ProtectedRoute: Starting auth validation");
      console.log("🛡️ ProtectedRoute: Redux state:", {
        isAuthenticated,
        hasToken: !!accessToken,
      });

      try {
        // First check: If Redux says not authenticated, respect that immediately
        if (!isAuthenticated) {
          console.log(
            "🛡️ ProtectedRoute: Redux isAuthenticated is false, blocking access"
          );
          setIsValid(false);
          setIsValidating(false);
          return;
        }

        // Second check: If no access token in Redux, block access
        if (!accessToken) {
          console.log(
            "🛡️ ProtectedRoute: No access token in Redux, blocking access"
          );
          setIsValid(false);
          setIsValidating(false);
          return;
        }

        // Third check: Validate with backend only if Redux state looks good
        console.log(
          "🛡️ ProtectedRoute: Redux state looks good, validating with backend"
        );
        const authState = await checkAuthState();
        console.log("🛡️ ProtectedRoute: checkAuthState result:", authState);

        if (!authState.isAuthenticated) {
          // Session is invalid, clear Redux state
          console.log(
            "🛡️ ProtectedRoute: Backend validation failed, logging out"
          );
          dispatch(logout());
          setIsValid(false);
        } else {
          console.log(
            "🛡️ ProtectedRoute: All validations passed, allowing access"
          );
          setIsValid(true);
        }
      } catch (error) {
        // Network error or invalid session
        console.log("🛡️ ProtectedRoute: Auth validation error:", error);
        dispatch(logout());
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateAuth();
  }, [isAuthenticated, accessToken, dispatch]); // Add back dependencies to re-run when Redux state changes

  // Show loading while validating
  if (isValidating) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect if validation failed
  if (!isValid) {
    console.log("🛡️ ProtectedRoute: Redirecting to auth - validation failed");
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
