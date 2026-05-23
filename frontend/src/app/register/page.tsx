"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password || !confirmPassword) {
      setError("請填寫所有欄位");
      return;
    }
    if (password.length < 8) {
      setError("密碼長度至少需要 8 個字元");
      return;
    }
    if (password !== confirmPassword) {
      setError("密碼與確認密碼不相符");
      return;
    }

    // Save mock user session to localStorage
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
          建立帳號
        </h1>
        <p className="text-xs text-text-muted select-none font-sans mb-8">開始與朋友聊天</p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <Input
            label="使用者名稱"
            type="text"
            placeholder="您的名稱"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError("");
            }}
            required
          />

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
            placeholder="至少 8 個字元"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            required
          />

          <Input
            label="確認密碼"
            type="password"
            placeholder="再次輸入密碼"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError("");
            }}
            required
          />

          {error && (
            <p className="text-xs text-red-600 font-sans text-center mt-1">{error}</p>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-3 py-3 select-none font-sans"
          >
            註冊
          </Button>
        </form>

        <div className="w-full text-center mt-6 pt-6 border-t border-border-secondary">
          <p className="text-xs text-text-muted font-sans select-none">
            已經有帳號？{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              立即登入
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
