"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError("Correo o contraseña incorrectos.");
      return;
    }
    router.push("/upload");
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: 16,
      }}
    >
      <form
        onSubmit={handleLogin}
        style={{
          background: "#1e293b",
          padding: 32,
          borderRadius: 12,
          width: "100%",
          maxWidth: 360,
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}
      >
        <h1 style={{ fontSize: 20, marginBottom: 24, textAlign: "center" }}>
          Seguimiento de Logística
        </h1>
        <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>
          Correo
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <label
          style={{
            fontSize: 13,
            display: "block",
            marginTop: 16,
            marginBottom: 4,
          }}
        >
          Contraseña
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
        {error && (
          <p style={{ color: "#f87171", fontSize: 13, marginTop: 12 }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 24,
            width: "100%",
            padding: "10px 0",
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#e2e8f0",
  fontSize: 14,
  boxSizing: "border-box",
};
