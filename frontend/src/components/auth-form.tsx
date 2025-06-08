import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setCredentials } from "@/store/authSlice"; 
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { WaitingForApproval } from "@/components/auth/WaitingForApproval";
import { toast } from "sonner";

type AuthFormProps = React.ComponentProps<"div"> & {
  mode: "login" | "register";
};

export function AuthForm({ className, mode, ...props }: AuthFormProps) {
  const isLogin = mode === "login";
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // 2FA state
  const [pendingAuth, setPendingAuth] = useState<{
    pendingAuthId: string;
    expiresAt: Date;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Prepare payload
    const payload =
      isLogin
        ? { username, password }
        : { username, password, userType: "USER" };

    // Determine URL and method
    const url = isLogin
      ? `${import.meta.env.VITE_API_URL}/auth/login-2fa`
      : `${import.meta.env.VITE_API_URL}/auth/register`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to authenticate");
      }

      const data = await res.json();

      // Handle 2FA flow for login
      if (isLogin && data.requiresApproval) {
        setPendingAuth({
          pendingAuthId: data.pendingAuthId,
          expiresAt: new Date(data.expiresAt),
        });
        toast.success("📱 Check your mobile device to approve the login");
        return;
      }

      // Handle successful authentication (no 2FA required or registration)
      if (data.success || data.access_token) {
        // For login, check user type before storing credentials
        if (isLogin && data.user) {
          if (data.user.userType !== "HOST") {
            throw new Error("Access denied. Only HOST users can access the dashboard.");
          }
        }
        
        // Dispatch to redux store
        dispatch(
          setCredentials({
            user: data.user,
            accessToken: data.access_token,
          })
        );
        
        toast.success(isLogin ? "Login successful!" : "Account created successfully!");
        navigate('/');
      } else {
        throw new Error(data.message || "Authentication failed");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // 2FA handlers
  const handleApproved = (tokens: { access_token: string; refresh_token: string }) => {
    // Get user info from token or make another API call
    // For now, we'll just store tokens and redirect
    dispatch(
      setCredentials({
        user: null, // You might need to decode the JWT or make an API call to get user info
        accessToken: tokens.access_token,
      })
    );
    setPendingAuth(null);
    toast.success("🎉 Login approved! Welcome back!");
    navigate('/');
  };

  const handleDenied = () => {
    setPendingAuth(null);
    setError("Login was denied from your mobile device");
    toast.error("❌ Login denied");
  };

  const handleExpired = () => {
    setPendingAuth(null);
    setError("Login request expired. Please try again.");
    toast.error("⏰ Login request expired");
  };

  const handleCancel = () => {
    setPendingAuth(null);
    setError(null);
  };

  // Show 2FA waiting screen if pending auth
  if (pendingAuth) {
    return (
      <WaitingForApproval
        pendingAuthId={pendingAuth.pendingAuthId}
        expiresAt={pendingAuth.expiresAt}
        onApproved={handleApproved}
        onDenied={handleDenied}
        onExpired={handleExpired}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>
            {isLogin ? "Login to your account" : "Create an account"}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? "Enter your username and password below to login"
              : "Enter your information to create a new account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-3">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="john_doe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-3">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  {isLogin && (
                    <a
                      href="#"
                      className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                    >
                      Forgot your password?
                    </a>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {/* Show error */}
              {error && (
                <div className="text-red-600 text-sm">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading
                    ? isLogin
                      ? "Logging in..."
                      : "Creating account..."
                    : isLogin
                    ? "Login"
                    : "Create account"}
                </Button>
                <Button variant="outline" className="w-full">
                  {isLogin ? "Login with Google" : "Sign up with Google"}
                </Button>
              </div>
            </div>
            <div className="mt-4 text-center text-sm">
              {isLogin ? (
                <>
                  Don&apos;t have an account?{" "}
                  <Link to="/register" className="underline underline-offset-4">
                    Sign up
                  </Link>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <Link to="/login" className="underline underline-offset-4">
                    Login
                  </Link>
                </>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
