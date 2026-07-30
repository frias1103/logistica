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
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        // Algunos exportadores dejan un "rango declarado" (!ref) desactualizado,
        // más chico que los datos reales. Lo recalculamos revisando todas las
        // celdas que realmente tienen contenido, para no perder filas.
        const cellAddresses = Object.keys(sheet).filter((k) => k[0] !== "!");
        if (cellAddresses.length > 0) {
          let minRow = Infinity,
            minCol = Infinity,
            maxRow = -Infinity,
            maxCol = -Infinity;
          for (const addr of cellAddresses) {
            const cell = XLSX.utils.decode_cell(addr);
            if (cell.r < minRow) minRow = cell.r;
            if (cell.c < minCol) minCol = cell.c;
            if (cell.r > maxRow) maxRow = cell.r;
            if (cell.c > maxCol) maxCol = cell.c;
          }
          sheet["!ref"] = XLSX.utils.encode_range({
            s: { r: minRow, c: minCol },
            e: { r: maxRow, c: maxCol },
          });
        }

        const json = XLSX.utils.sheet_to_json(sheet, { raw: false });
        resolve(json as any[]);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
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
  const [notifInfo, setNotifInfo] = useState<any>(null);

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

      const filasLeidasGeneral = generalRows.length;
      const filasLeidasProductos = productRows.length;

      // Dividimos en lotes pequeños para no exceder el límite de tamaño de Vercel (~4.5MB por solicitud)
      const generalBatches = chunk(generalRows, 300);
      const productBatches = chunk(productRows, 800);

      const totals = {
        filasLeidasGeneral,
        filasLeidasProductos,
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

      // Enviar notificación de WhatsApp (silenciosamente; si falla, no afecta la subida)
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          const notifRes = await fetch("/api/send-notifications", {
            method: "POST",
            headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
          });
          const notifJson = await notifRes.json();
          setNotifInfo(notifJson);
        }
      } catch {
        // silencioso: la subida ya se completó bien, la notificación es un extra
      }
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
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/dashboard")} style={primaryBtn}>
            Ver dashboard
          </button>
          <button onClick={handleLogout} style={secondaryBtn}>
            Cerrar sesión
          </button>
        </div>
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
              <li>Filas leídas del archivo general: {result.filasLeidasGeneral}</li>
              <li>Filas leídas del archivo de productos: {result.filasLeidasProductos}</li>
              <li>Total de órdenes procesadas: {result.totalProcesado}</li>
              <li>Órdenes nuevas: {result.nuevos}</li>
              <li>Órdenes que cambiaron de estatus hoy: {result.cambiaronEstatus}</li>
              <li>Órdenes sin cambio de estatus: {result.sinCambio}</li>
              <li>Líneas de producto actualizadas: {result.productosActualizados}</li>
            </ul>
            {result.filasLeidasGeneral !== result.totalProcesado && (
              <p style={{ color: "#fbbf24", marginTop: 12 }}>
                ⚠️ Las filas leídas y las procesadas no coinciden — revisa el
                archivo o avísame.
              </p>
            )}
            {notifInfo && (
              <p style={{ color: "#94a3b8", marginTop: 12, fontSize: 13 }}>
                {notifInfo.resultadoEnvio?.skipped
                  ? `⚠️ WhatsApp no configurado: ${notifInfo.resultadoEnvio.reason}`
                  : notifInfo.resultadoEnvio?.ok
                  ? `📲 Notificación de WhatsApp enviada (🟠 ${notifInfo.naranja} / 🔴 ${notifInfo.rojo}).`
                  : "⚠️ No se pudo enviar la notificación de WhatsApp."}
              </p>
            )}
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
