"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("請填寫所有欄位");
      return;
    }
    if (password.length < 8) {
      setError("密碼長度至少需要 8 個字元");
      return;
    }

    // Save mock user session to localStorage
    const username = email.split("@")[0];
    localStorage.setItem(
      "user",
      JSON.stringify({
        username: username,
        email: email,
        bio: "隨意聊天的地方",
        avatar: "",
      })
    );
    localStorage.setItem("token", "mock-jwt-token");

    // Redirect to Main Page
    router.push("/");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background transition-colors">
      <div className="w-full max-w-sm border border-border-primary rounded-sm bg-surface-card p-8 flex flex-col items-center">
        {/* Minimal Blueprint Logo */}
        <div className="h-16 w-16 border border-border-primary bg-surface-muted rounded-sm flex items-center justify-center mb-6">
          <svg
            className="h-8 w-8 text-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="3" y="3" width="18" height="14" rx="2" strokeLinejoin="round" />
            <path d="M7 21h10M12 17v4" />
          </svg>
        </div>

        <h1 className="text-xl font-bold uppercase tracking-wider text-foreground mb-1 select-none font-sans">
          歡迎回來！
        </h1>
        <p className="text-xs text-text-muted select-none font-sans mb-8">登入您的帳戶</p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
          <Input
            label="電子郵件"
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
            label="密碼"
            type="password"
            placeholder="......"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            required
          />

          <div className="flex items-center justify-between py-1">
            <Checkbox
              label="記住我"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 font-sans text-center">{error}</p>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2 py-3 select-none font-sans"
          >
            登入
          </Button>
        </form>

        <div className="w-full text-center mt-6 pt-6 border-t border-border-secondary">
          <p className="text-xs text-text-muted font-sans select-none">
            還沒有帳號？{" "}
            <Link href="/register" className="text-primary font-semibold hover:underline">
              立即註冊
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
