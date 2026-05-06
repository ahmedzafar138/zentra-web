import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Mail, Lock, User, Eye, EyeOff, Chrome, Facebook } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { login } from "@/store/slices/authSlice";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL, fetchWithTimeout } from "@/lib/utils";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "login";
  const [isSignUp, setIsSignUp] = useState(mode === "signup");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Sync state with URL
  useEffect(() => {
    setIsSignUp(mode === "signup");
  }, [mode]);

  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/onboarding" replace />;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp && formData.password !== formData.confirmPassword) {
        toast({
          title: "Passwords do not match",
          description: "Please ensure both passwords are identical.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      console.log("API_BASE_URL:", API_BASE_URL);

      if (isSignUp) {
        const registerUrl = `${API_BASE_URL}/api/v1/auth/register`;
        const requestBody = {
          email: formData.email,
          password: formData.password,
          first_name: formData.firstName,
          last_name: formData.lastName,
        };

        console.log("🚀 Attempting signup with:");
        console.log("URL:", registerUrl);
        console.log("Request body:", requestBody);
        console.log("API_BASE_URL value:", API_BASE_URL);

        try {
          // First, test if backend is reachable with a simple GET request
          console.log("🔍 Testing backend connectivity...");
          try {
            const healthCheck = await fetch(`${API_BASE_URL}/health`, {
              method: "GET",
              timeout: 5000,
            });
            console.log("✅ Health check status:", healthCheck.status);
          } catch (healthError) {
            console.error("❌ Health check failed:", healthError);
          }

          const res = await fetchWithTimeout(registerUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            timeoutMs: 5000, // Reduced timeout for faster debugging
          });
          console.log("✅ Register response status:", res.status);
          console.log("✅ Register response headers:", res.headers);

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error("❌ Register failed:", err);
            throw new Error(err.detail || "Signup failed");
          }

          console.log("✅ Register successful, proceeding to auto-login...");

          // After successful signup, auto-login
          const loginRes = await fetchWithTimeout(
            `${API_BASE_URL}/api/v1/auth/login`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: formData.email,
                password: formData.password,
              }),
              timeoutMs: 15000,
            }
          );
          console.log("/login status (after signup):", loginRes.status);
          if (!loginRes.ok) {
            const err = await loginRes.json().catch(() => ({}));
            throw new Error(err.detail || "Login after signup failed");
          }
          const tokens = await loginRes.json();
          dispatch(
            login({
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              user: {
                id: String(tokens.user_id ?? ""),
                email: formData.email,
                firstName: formData.firstName,
                lastName: formData.lastName,
              },
            })
          );
          toast({
            title: "Account created successfully!",
            description: "You have been logged in successfully.",
          });
        } catch (error) {
          console.error("❌ Signup error:", error);
          console.error("❌ Error type:", error.constructor.name);
          console.error("❌ Error message:", error.message);
          throw error;
        }
      } else {
        const loginRes = await fetchWithTimeout(
          `${API_BASE_URL}/api/v1/auth/login`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
            }),
            timeoutMs: 15000,
          }
        );
        console.log("/login status:", loginRes.status);
        if (!loginRes.ok) {
          const err = await loginRes.json().catch(() => ({}));
          throw new Error(err.detail || "Invalid credentials");
        }
        const tokens = await loginRes.json();

        // For login, we need to get user details from the /me endpoint
        const userRes = await fetchWithTimeout(
          `${API_BASE_URL}/api/v1/auth/me`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
              "Content-Type": "application/json",
            },
            timeoutMs: 15000,
          }
        );

        if (userRes.ok) {
          const userData = await userRes.json();
          dispatch(
            login({
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              user: {
                id: String(userData.id),
                email: userData.email,
                firstName: userData.first_name,
                lastName: userData.last_name,
              },
            })
          );
        } else {
          // Fallback to form data if /me fails
          dispatch(
            login({
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              user: {
                id: String(tokens.user_id ?? ""),
                email: formData.email,
                firstName: formData.firstName || "User",
                lastName: formData.lastName || "Name",
              },
            })
          );
        }

        toast({
          title: "Welcome back!",
          description: "You have been logged in successfully.",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";
      toast({ title: "Error", description: message, variant: "destructive" });
      console.error("Auth error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    toast({
      title: "Social Login",
      description: `${provider} login will be implemented with backend integration.`,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-bg flex items-center justify-center px-4 pt-20">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-glow border-0 bg-gradient-card">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gradient-primary">
              {isSignUp ? "Create Account" : "Welcome Back"}
            </CardTitle>
            <p className="text-muted-foreground">
              {isSignUp
                ? "Start your personalized nutrition journey"
                : "Sign in to your account"}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="firstName"
                        name="firstName"
                        type="text"
                        placeholder="John"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="lastName"
                        name="lastName"
                        type="text"
                        placeholder="Doe"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="pl-10 pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-auto p-1"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="pl-10 pr-10"
                      required
                    />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-primary hover-lift"
                disabled={isLoading}
              >
                {isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                  />
                ) : isSignUp ? (
                  "Create Account"
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="relative">
              <Separator className="my-6" />
            </div>
            <div className="text-center text-sm">
              {isSignUp ? (
                <p className="text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    onClick={() => setIsSignUp(false)}
                    className="text-primary hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Don't have an account?{" "}
                  <button
                    onClick={() => setIsSignUp(true)}
                    className="text-primary hover:underline font-medium"
                  >
                    Sign up
                  </button>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Auth;
