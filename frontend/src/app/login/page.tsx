"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { login } from "@/lib/api";

const getFriendlyLoginError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";

  if (message === "Invalid email or password") {
    return "帳號或密碼錯誤，請重新確認後再試一次。";
  }

  if (message === "Invalid email format") {
    return "Email 格式不正確，請重新輸入。";
  }

  if (message === "Failed to fetch" || message.includes("fetch")) {
    return "目前無法連線到伺服器，請確認系統服務已啟動後再試一次。";
  }

  return "登入失敗，請稍後再試一次。";
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Near | 登入";
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("請輸入 Email 與密碼。");
      return;
    }
    if (password.length < 8) {
      setError("密碼至少需要 8 個字元。");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const result = await login({ email, password });
      localStorage.setItem(
        "user",
        JSON.stringify({
          userId: result.user.userId,
          username: result.user.name,
          email,
          avatar: result.user.avatarUrl ?? "",
        }),
      );
      router.push("/");
    } catch (err) {
      setError(getFriendlyLoginError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background transition-colors">
      <div className="w-full max-w-sm border border-border-primary rounded-sm bg-surface-card p-8 flex flex-col items-center">
        <div className="h-16 w-16 border border-border-primary bg-surface-muted rounded-sm flex items-center justify-center mb-6 overflow-hidden">
          <Image
            src="/near.png"
            alt="Near logo"
            width={64}
            height={64}
            className="object-contain size-full"
          />
        </div>

        <h1 className="text-xl font-bold uppercase tracking-wider text-foreground mb-1 select-none font-sans">
          Near
        </h1>
        <p className="text-xs text-text-muted select-none font-sans mb-8">Sign in to Near</p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
          <Input
            label="Email"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="........"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            required
          />


          {error && <p className="text-xs text-red-600 font-sans text-center">{error}</p>}

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2 py-3 select-none font-sans"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="w-full text-center mt-6 pt-6 border-t border-border-secondary">
          <p className="text-xs text-text-muted font-sans select-none">
            No account yet?{" "}
            <Link href="/register" className="text-primary font-semibold hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
