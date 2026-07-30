"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

type Tab = "estatus" | "transportadoras" | "dinero" | "producto" | "productividad" | "tags";

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
    { key: "tags", label: "Tags" },
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
      {tab === "tags" && <TagsTab data={data} />}
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
  // Agrupamos por ciudad (de mayor a menor volumen), y dentro de cada ciudad
  // ordenamos las transportadoras usadas ahí, también de mayor a menor.
  const ciudadGroups = new Map<string, { total: number; rows: any[] }>();
  for (const t of data.transportadoraCiudad) {
    if (!ciudadGroups.has(t.ciudad)) {
      ciudadGroups.set(t.ciudad, { total: 0, rows: [] });
    }
    const g = ciudadGroups.get(t.ciudad)!;
    g.total += t.total;
    g.rows.push(t);
  }
  const groupedByCiudad = Array.from(ciudadGroups.entries())
    .map(([ciudad, g]) => ({
      ciudad,
      total: g.total,
      rows: [...g.rows].sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total - a.total);

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
      {groupedByCiudad.map((g) => (
        <div key={g.ciudad} style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, color: "#93c5fd", margin: "12px 0 6px" }}>
            {g.ciudad} — {g.total} pedidos
          </div>
          <Table
            headers={["Transportadora", "Entregado", "Devolución", "En tránsito", "Total"]}
            rows={g.rows.map((t: any) => [
              t.transportadora,
              countPct(t.entregado, t.total),
              countPct(t.devolucion, t.total),
              countPct(t.en_transito, t.total),
              t.total,
            ])}
          />
        </div>
      ))}
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
  const productos = data.productoResumen; // ya viene ordenado de mayor a menor total
  const [selected, setSelected] = useState<string>("__todos__");

  const grouped = new Map<string, any[]>();
  for (const pc of data.productoCiudad) {
    if (!grouped.has(pc.producto)) grouped.set(pc.producto, []);
    grouped.get(pc.producto)!.push(pc);
  }

  const productosAMostrar =
    selected === "__todos__" ? productos : productos.filter((p: any) => p.producto === selected);

  return (
    <div>
      <h3 style={h3}>Por producto</h3>
      <Table
        headers={["Producto", "Entregado", "Devolución", "Cancelado", "En tránsito", "Total"]}
        rows={productos.map((p: any) => [
          p.producto,
          countPct(p.entregado, p.total),
          countPct(p.devolucion, p.total),
          countPct(p.cancelado, p.total),
          countPct(p.en_transito, p.total),
          p.total,
        ])}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0 12px" }}>
        <h3 style={{ ...h3, margin: 0 }}>Cruce producto × ciudad</h3>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} style={selectStyle}>
          <option value="__todos__">Todos los productos</option>
          {productos.map((p: any) => (
            <option key={p.producto} value={p.producto}>
              {p.producto}
            </option>
          ))}
        </select>
      </div>

      {productosAMostrar.map((p: any) => {
        const rows = (grouped.get(p.producto) || [])
          .map((c: any) => ({ ...c, total: c.entregado + c.devolucion + c.cancelado + c.en_transito }))
          .sort((a: any, b: any) => b.total - a.total);
        return (
          <div key={p.producto} style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, color: "#93c5fd", margin: "12px 0 6px" }}>
              {p.producto} — {p.total} pedidos
            </div>
            <Table
              headers={["Ciudad", "Entregado", "Devolución", "Cancelado", "En tránsito", "Total"]}
              rows={rows.map((c: any) => [
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
      })}
    </div>
  );
}

function ProductividadTab({ data }: any) {
  return (
    <div>
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

function TagsTab({ data }: any) {
  return (
    <div>
      {data.tagsResumen.map((t: any) => (
        <div key={t.tag} style={{ marginBottom: 36 }}>
          <div
            style={{
              background: "#1e293b",
              borderRadius: 10,
              padding: 16,
              borderLeft: "4px solid #a855f7",
              marginBottom: 12,
              maxWidth: 320,
            }}
          >
            <div style={{ fontSize: 13, color: "#94a3b8" }}>🏷️ {t.tag}</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{t.cantidad}</div>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>
              {t.pctDelTotal}% del total de órdenes
            </div>
          </div>

          <h3 style={h3}>Por ciudad — {t.tag}</h3>
          <Table
            headers={["Ciudad", "Entregado", "Devolución", "En tránsito", "Total"]}
            rows={t.porCiudad.map((c: any) => [
              c.ciudad,
              `${c.entregado} (${c.entregadoPct}%)`,
              `${c.devolucion} (${c.devolucionPct}%)`,
              `${c.enTransito} (${c.enTransitoPct}%)`,
              c.total,
            ])}
          />
        </div>
      ))}
      <p style={{ color: "#64748b", fontSize: 13 }}>
        Solo se cuentan órdenes que sí se enviaron (se excluyen cancelado,
        rechazado, pendiente confirmación y guía anulada).
      </p>
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

const selectStyle: React.CSSProperties = {
  padding: "6px 10px",
  background: "#1e293b",
  color: "#e2e8f0",
  border: "1px solid #334155",
  borderRadius: 8,
  fontSize: 13,
};
