"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

type Tab = "estatus" | "transportadoras" | "dinero" | "producto" | "productividad";

const money = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

function countPct(count: number, total: number) {
  if (!total) return `${count} (0%)`;
  const p = Math.round((count / total) * 1000) / 10;
  return `${count} (${p}%)`;
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("estatus");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }
      setCheckingAuth(false);
      try {
        const res = await fetch("/api/dashboard-data", {
          headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Error cargando el dashboard.");
        } else {
          setData(json);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  if (checkingAuth || loading) {
    return <div style={{ padding: 40 }}>Cargando dashboard...</div>;
  }

  if (error) {
    return <div style={{ padding: 40, color: "#f87171" }}>Error: {error}</div>;
  }

  if (!data) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "estatus", label: "Estatus" },
    { key: "transportadoras", label: "Transportadoras" },
    { key: "dinero", label: "Dinero" },
    { key: "producto", label: "Producto" },
    { key: "productividad", label: "Productividad" },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h1 style={{ fontSize: 22 }}>Dashboard de Logística</h1>
        <button onClick={() => router.push("/upload")} style={secondaryBtn}>
          Ir a subir archivos
        </button>
      </div>
      <p style={{ color: "#94a3b8", marginBottom: 24 }}>
        {data.total} órdenes en total en el historial guardado.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={tab === t.key ? tabBtnActive : tabBtn}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "estatus" && <EstatusTab data={data} />}
      {tab === "transportadoras" && <TransportadorasTab data={data} />}
      {tab === "dinero" && <DineroTab data={data} />}
      {tab === "producto" && <ProductoTab data={data} />}
      {tab === "productividad" && <ProductividadTab data={data} />}
    </div>
  );
}

function EstatusTab({ data }: any) {
  const b = data.buckets;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="✅ Entregado" count={b.entregado.count} pctVal={b.entregado.pct} color="#22c55e" />
        <StatCard label="🔁 Devolución" count={b.devolucion.count} pctVal={b.devolucion.pct} color="#f97316" />
        <StatCard label="🚫 Cancelado" count={b.cancelado.count} pctVal={b.cancelado.pct} color="#ef4444" />
        <StatCard label="🚚 En tránsito" count={b.en_transito.count} pctVal={b.en_transito.pct} color="#3b82f6" />
        <StatCard label="⏳ Otros (pendientes/rechazado)" count={b.otros.count} pctVal={b.otros.pct} color="#94a3b8" />
      </div>

      <h3 style={h3}>Detalle por estatus</h3>
      <Table
        headers={["Estatus", "Cantidad", "%"]}
        rows={data.porEstatus.map((e: any) => [e.estatus, e.count, `${e.pct}%`])}
      />

      <h3 style={h3}>Por ciudad destino</h3>
      <Table
        headers={["Ciudad", "Entregado", "Devolución", "Cancelado", "En tránsito", "Total"]}
        rows={data.porCiudad.map((c: any) => [
          c.ciudad,
          countPct(c.entregado, c.total),
          countPct(c.devolucion, c.total),
          countPct(c.cancelado, c.total),
          countPct(c.en_transito, c.total),
          c.total,
        ])}
      />
    </div>
  );
}

function TransportadorasTab({ data }: any) {
  return (
    <div>
      <h3 style={h3}>Efectividad por transportadora</h3>
      <Table
        headers={["Transportadora", "Enviados", "Entregados", "%", "Devueltos", "%", "En tránsito", "%"]}
        rows={data.transportadoras.map((t: any) => [
          t.transportadora,
          t.enviados,
          t.entregados,
          `${t.entregadosPct}%`,
          t.devueltos,
          `${t.devueltosPct}%`,
          t.enTransito,
          `${t.enTransitoPct}%`,
        ])}
      />

      <h3 style={h3}>Cruce transportadora × ciudad</h3>
      <Table
        headers={["Transportadora", "Ciudad", "Entregado", "Devolución", "En tránsito", "Total"]}
        rows={data.transportadoraCiudad.map((t: any) => [
          t.transportadora,
          t.ciudad,
          countPct(t.entregado, t.total),
          countPct(t.devolucion, t.total),
          countPct(t.en_transito, t.total),
          t.total,
        ])}
      />
    </div>
  );
}

function DineroTab({ data }: any) {
  const d = data.dinero;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <MoneyCard label="💰 Ganancia realizada (entregado)" value={d.entregado.suma} count={d.entregado.cantidad} color="#22c55e" />
        <MoneyCard label="🚚 Ganancia en camino (en tránsito)" value={d.en_transito.suma} count={d.en_transito.cantidad} color="#3b82f6" />
        <MoneyCard label="🔁 Ajuste por devoluciones" value={d.devolucion.suma} count={d.devolucion.cantidad} color="#f97316" />
      </div>
      <p style={{ color: "#64748b", fontSize: 13, marginTop: 20 }}>
        Ganancia = Valor de compra en productos − Precio flete − Total precios proveedor
        (en devoluciones, además se resta el costo de flete de devolución).
      </p>
    </div>
  );
}

function ProductoTab({ data }: any) {
  return (
    <div>
      <h3 style={h3}>Por producto</h3>
      <Table
        headers={["Producto", "Entregado", "Devolución", "Cancelado", "En tránsito", "Total"]}
        rows={data.productoResumen.map((p: any) => [
          p.producto,
          p.entregado,
          p.devolucion,
          p.cancelado,
          p.en_transito,
          p.total,
        ])}
      />

      <h3 style={h3}>Cruce producto × ciudad</h3>
      <Table
        headers={["Producto", "Ciudad", "Entregado", "Devolución", "Cancelado", "En tránsito"]}
        rows={data.productoCiudad.map((p: any) => [
          p.producto,
          p.ciudad,
          p.entregado,
          p.devolucion,
          p.cancelado,
          p.en_transito,
        ])}
      />
    </div>
  );
}

function ProductividadTab({ data }: any) {
  return (
    <div>
      <h3 style={h3}>Guías generadas por día (proveedor/cuenta)</h3>
      <Table
        headers={["Usuario/Cuenta", "Fecha", "Guías generadas"]}
        rows={data.guiasPorUsuarioPorDia.map((g: any) => [g.usuario, g.fecha, g.cantidad])}
      />

      <h3 style={h3}>Órdenes confirmadas por vendedor (histórico acumulado)</h3>
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: 12 }}>
        Nota: este número es acumulado histórico, no por día — el archivo no
        trae la fecha exacta en que cada vendedor confirmó. Para tenerlo por
        día necesitamos activar la comparación de snapshots (Idea 1).
      </p>
      <Table
        headers={["Vendedor", "Órdenes confirmadas"]}
        rows={data.confirmacionesPorVendedor.map((v: any) => [v.vendedor, v.cantidad])}
      />
    </div>
  );
}

function StatCard({ label, count, pctVal, color }: any) {
  return (
    <div style={{ background: "#1e293b", borderRadius: 10, padding: 16, borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 13, color: "#94a3b8" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{count}</div>
      <div style={{ fontSize: 13, color: "#94a3b8" }}>{pctVal}%</div>
    </div>
  );
}

function MoneyCard({ label, value, count, color }: any) {
  return (
    <div style={{ background: "#1e293b", borderRadius: 10, padding: 16, borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 13, color: "#94a3b8" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{money(value)}</div>
      <div style={{ fontSize: 13, color: "#94a3b8" }}>{count} órdenes</div>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: any[][] }) {
  return (
    <div style={{ overflowX: "auto", marginBottom: 32, background: "#1e293b", borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td style={td} colSpan={headers.length}>
                Sin datos.
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: "1px solid #334155" }}>
              {r.map((cell, j) => (
                <td key={j} style={td}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  color: "#94a3b8",
  fontWeight: 600,
  borderBottom: "1px solid #334155",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "8px 12px",
  whiteSpace: "nowrap",
};

const h3: React.CSSProperties = {
  fontSize: 16,
  margin: "24px 0 12px",
};

const tabBtn: React.CSSProperties = {
  padding: "8px 16px",
  background: "#1e293b",
  color: "#94a3b8",
  border: "1px solid #334155",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
};

const tabBtnActive: React.CSSProperties = {
  ...tabBtn,
  background: "#2563eb",
  color: "white",
  border: "1px solid #2563eb",
};

const secondaryBtn: React.CSSProperties = {
  padding: "8px 16px",
  background: "transparent",
  color: "#94a3b8",
  border: "1px solid #334155",
  borderRadius: 8,
  cursor: "pointer",
};
