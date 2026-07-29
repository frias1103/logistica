"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabaseClient";

function parseExcelFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { raw: false });
        resolve(json as any[]);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

export default function UploadPage() {
  const router = useRouter();
  const supabase = createClient();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [generalFile, setGeneralFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      } else {
        setCheckingAuth(false);
      }
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      out.push(arr.slice(i, i + size));
    }
    return out;
  }

  async function sendBatch(generalRows: any[], productRows: any[]) {
    const res = await fetch("/api/process-daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generalRows, productRows }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Ocurrió un error procesando un lote.");
    }
    return json;
  }

  async function handleProcess() {
    if (!generalFile) {
      setError("Debes subir al menos el archivo general del día.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const generalRows = await parseExcelFile(generalFile);
      const productRows = productFile ? await parseExcelFile(productFile) : [];

      // Dividimos en lotes pequeños para no exceder el límite de tamaño de Vercel (~4.5MB por solicitud)
      const generalBatches = chunk(generalRows, 300);
      const productBatches = chunk(productRows, 800);

      const totals = {
        totalProcesado: 0,
        nuevos: 0,
        cambiaronEstatus: 0,
        sinCambio: 0,
        productosActualizados: 0,
      };

      setProgress(`Enviando lote 1 de ${generalBatches.length + productBatches.length}...`);

      let batchNumber = 0;
      for (const batch of generalBatches) {
        batchNumber++;
        setProgress(
          `Procesando órdenes: lote ${batchNumber} de ${generalBatches.length}...`
        );
        const json = await sendBatch(batch, []);
        totals.totalProcesado += json.totalProcesado;
        totals.nuevos += json.nuevos;
        totals.cambiaronEstatus += json.cambiaronEstatus;
        totals.sinCambio += json.sinCambio;
      }

      batchNumber = 0;
      for (const batch of productBatches) {
        batchNumber++;
        setProgress(
          `Procesando productos: lote ${batchNumber} de ${productBatches.length}...`
        );
        const json = await sendBatch([], batch);
        totals.productosActualizados += json.productosActualizados;
      }

      setProgress(null);
      setResult(totals);
    } catch (err: any) {
      setProgress(null);
      setError(err.message || "Ocurrió un error leyendo los archivos.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingAuth) {
    return <div style={{ padding: 40 }}>Verificando sesión...</div>;
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 32 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 22 }}>Subida diaria de reportes</h1>
        <button onClick={handleLogout} style={secondaryBtn}>
          Cerrar sesión
        </button>
      </div>

      <div style={card}>
        <label style={label}>
          1. Archivo general del día (con dinero, vendedor, transportadora)
        </label>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setGeneralFile(e.target.files?.[0] || null)}
          style={{ marginBottom: 20 }}
        />

        <label style={label}>
          2. Archivo de productos del día (opcional, si lo tienes)
        </label>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setProductFile(e.target.files?.[0] || null)}
        />

        <button
          onClick={handleProcess}
          disabled={loading}
          style={{ ...primaryBtn, marginTop: 28 }}
        >
          {loading ? "Procesando..." : "Procesar y guardar historial"}
        </button>

        {progress && (
          <p style={{ color: "#93c5fd", marginTop: 16 }}>{progress}</p>
        )}

        {error && (
          <p style={{ color: "#f87171", marginTop: 16 }}>{error}</p>
        )}

        {result && (
          <div
            style={{
              marginTop: 24,
              background: "#0f172a",
              padding: 16,
              borderRadius: 8,
            }}
          >
            <p>✅ Procesado correctamente.</p>
            <ul style={{ marginTop: 8, lineHeight: 1.8 }}>
              <li>Total de órdenes procesadas: {result.totalProcesado}</li>
              <li>Órdenes nuevas: {result.nuevos}</li>
              <li>Órdenes que cambiaron de estatus hoy: {result.cambiaronEstatus}</li>
              <li>Órdenes sin cambio de estatus: {result.sinCambio}</li>
              <li>Líneas de producto actualizadas: {result.productosActualizados}</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#1e293b",
  padding: 24,
  borderRadius: 12,
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 14,
  marginBottom: 8,
  fontWeight: 600,
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 20px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  padding: "8px 16px",
  background: "transparent",
  color: "#94a3b8",
  border: "1px solid #334155",
  borderRadius: 8,
  cursor: "pointer",
};
