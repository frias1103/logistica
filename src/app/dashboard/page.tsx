"use client";

import { useEffect, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

async function getFreshToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

type Tab =
  | "general"
  | "seguimiento"
  | "estatus"
  | "transportadoras"
  | "dinero"
  | "producto"
  | "productividad"
  | "tags"
  | "historialEstatus"
  | "diasPendientes";

const money = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

function pctCell(count: number, total: number) {
  const p = total ? Math.round((count / total) * 1000) / 10 : 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span>{count}</span>
      <span
        style={{
          background: "#334155",
          color: "#e2e8f0",
          fontSize: 12,
          fontWeight: 600,
          padding: "2px 7px",
          borderRadius: 999,
        }}
      >
        {p}%
      </span>
    </span>
  );
}

function colorForDias(d: number) {
  if (d <= 4) return "rgba(34, 197, 94, 0.15)";
  if (d <= 9) return "rgba(234, 179, 8, 0.15)";
  if (d <= 20) return "rgba(249, 115, 22, 0.18)";
  return "rgba(239, 68, 68, 0.2)";
}

function formatFecha(f: string | null) {
  if (!f) return "-";
  const [y, m, d] = f.split("-");
  return `${d}/${m}/${y}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

 const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("general");
  const [token, setToken] = useState<string>("");
  
const [mes, setMes] = useState<string>("__todos__");

  async function cargarDatos(accessToken: string, mesSeleccionado: string) {
    setLoading(true);
    try {
      const url =
        mesSeleccionado === "__todos__"
          ? "/api/dashboard-data"
          : `/api/dashboard-data?mes=${mesSeleccionado}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error cargando el dashboard.");
      } else {
        setData(json);
        setError(null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }
      setCheckingAuth(false);
      setToken(sessionData.session.access_token);
      await cargarDatos(sessionData.session.access_token, "__todos__");
    });
  }, []);

  function cambiarMes(nuevoMes: string) {
    setMes(nuevoMes);
    if (token) cargarDatos(token, nuevoMes);
  }

  if (checkingAuth || loading) {
    return <div style={{ padding: 40 }}>Cargando dashboard...</div>;
  }

  if (error) {
    return <div style={{ padding: 40, color: "#f87171" }}>Error: {error}</div>;
  }

  if (!data) return null;
function actualizarFechaReportado(id: string, fecha: string | null) {
    setData((prev: any) => {
      if (!prev) return prev;
      const nuevosGrupos = prev.seguimiento.grupos.map((g: any) => ({
        ...g,
        ordenes: g.ordenes.map((o: any) => (o.id === id ? { ...o, fecha_reportado: fecha } : o)),
      }));
      const nuevosDias = (prev.diasPendientes || []).map((d: any) => ({
        ...d,
        ordenes: d.ordenes.map((o: any) => (o.id === id ? { ...o, fecha_reportado: fecha } : o)),
      }));
      return {
        ...prev,
        seguimiento: { ...prev.seguimiento, grupos: nuevosGrupos },
        diasPendientes: nuevosDias,
      };
    });
  }

  function actualizarNota(id: string, nota: string | null) {
    setData((prev: any) => {
      if (!prev) return prev;
      const nuevosGrupos = prev.seguimiento.grupos.map((g: any) => ({
        ...g,
        ordenes: g.ordenes.map((o: any) => (o.id === id ? { ...o, nota } : o)),
      }));
      const nuevosDias = (prev.diasPendientes || []).map((d: any) => ({
        ...d,
        ordenes: d.ordenes.map((o: any) => (o.id === id ? { ...o, nota } : o)),
      }));
      return {
        ...prev,
        seguimiento: { ...prev.seguimiento, grupos: nuevosGrupos },
        diasPendientes: nuevosDias,
      };
    });
  }
    const tabs: { key: Tab; label: string }[] = [
    { key: "general", label: "General" },
    { key: "seguimiento", label: "Seguimiento" },
    { key: "estatus", label: "Estatus" },
    { key: "transportadoras", label: "Transportadoras" },
    { key: "dinero", label: "Dinero" },
    { key: "producto", label: "Producto" },
    { key: "productividad", label: "Productividad" },
     { key: "historialEstatus", label: "Historial de Estatus" },
    { key: "diasPendientes", label: "Días Pendientes" },
    { key: "tags", label: "Tags" },
  ];

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto", padding: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h1 style={{ fontSize: 22 }}>Dashboard de Logística</h1>
        <button onClick={() => router.push("/upload")} style={secondaryBtn}>
          Ir a subir archivos
        </button>
      </div>
<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ color: "#94a3b8", fontSize: 13 }}>Ver:</span>
        <select value={mes} onChange={(e) => cambiarMes(e.target.value)} style={selectStyle}>
          <option value="__todos__">Todos los meses</option>
          {data.mesesDisponibles.map((m: string) => (
            <option key={m} value={m}>
              {nombreMes(m)}
            </option>
          ))}
        </select>
      </div>

      <p style={{ color: "#94a3b8", marginBottom: 24 }}>
        {data.total} órdenes en total en el historial guardado
        {data.huerfanas > 0 && (
          <span>
            {" "}
            ({data.totalActivo} activas — se excluyen {data.huerfanas} que dejaron de
            aparecer en los reportes sin llegar a un estatus final)
          </span>
        )}
        .
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

{tab === "seguimiento" && (
        <SeguimientoTab
          data={data}
          token={token}
          onMarcar={actualizarFechaReportado}
          onNota={actualizarNota}
        />
      )}
          {tab === "general" && <GeneralTab data={data} />}
      {tab === "estatus" && <EstatusTab data={data} />}
      {tab === "transportadoras" && <TransportadorasTab data={data} />}
      {tab === "dinero" && <DineroTab data={data} />}
      {tab === "producto" && <ProductoTab data={data} />}
      {tab === "productividad" && <ProductividadTab data={data} />}
      {tab === "historialEstatus" && <HistorialEstatusTab data={data} />}
       {tab === "tags" && <TagsTab data={data} />}
      {tab === "diasPendientes" && (
        <DiasPendientesTab data={data} token={token} onMarcar={actualizarFechaReportado} onNota={actualizarNota} />
      )}
    </div>
  );
}

function nombreMes(m: string) {
  const [anio, mes] = m.split("-");
  const nombres = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  return `${nombres[parseInt(mes, 10) - 1]} ${anio}`;
}
const SEGUIMIENTO_PAGE_SIZE = 50;

function diasEntre(fechaDesde: string | null, fechaHasta: string | null) {
  if (!fechaDesde || !fechaHasta) return null;
  const a = new Date(fechaDesde + "T00:00:00");
  const b = new Date(fechaHasta + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function SeguimientoTab({ data, token, onMarcar, onNota }: any) {
  const s = data.seguimiento;
  const [selected, setSelected] = useState<string>("__todos__");
  const [orden, setOrden] = useState<"desc" | "asc">("desc"); // desc = más viejas primero

  const gruposAMostrar =
    selected === "__todos__" ? s.grupos : s.grupos.filter((g: any) => g.estatus === selected);

  return (
    <div>
      <p style={{ color: "#94a3b8", marginBottom: 16 }}>
        Corte al {formatFecha(s.fechaReporte)}. Se excluyen órdenes ya cerradas
        (entregado, devolución, cancelado, rechazado, guía anulada). Se
        considera "sin movimiento" cuando lleva más de 2 días en el mismo
        estatus.
      </p>

      <h3 style={h3}>Panorama general — {s.totalSinMovimiento} órdenes sin movimiento</h3>
      <Table
        headers={["Estatus", "Total en este estatus", "Sin movimiento (+2 días)", "%"]}
        rows={s.resumenPorEstatus.map((r: any) => [
          r.estatus,
          r.totalEnEstatus,
          r.sinMovimiento,
          `${r.pct}%`,
        ])}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0 12px", flexWrap: "wrap" }}>
        <h3 style={{ ...h3, margin: 0 }}>Detalle por estatus</h3>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} style={selectStyle}>
          <option value="__todos__">Todos los estatus</option>
          {s.grupos.map((g: any) => (
            <option key={g.estatus} value={g.estatus}>
              {g.estatus}
            </option>
          ))}
        </select>
        <span style={{ color: "#94a3b8", fontSize: 13 }}>Ordenar por:</span>
        <select value={orden} onChange={(e) => setOrden(e.target.value as "desc" | "asc")} style={selectStyle}>
          <option value="desc">Más días sin mover primero</option>
          <option value="asc">Menos días sin mover primero</option>
        </select>
      </div>

      {gruposAMostrar.map((g: any) => (
<GrupoSeguimiento
          key={g.estatus}
          grupo={g}
          orden={orden}
          token={token}
          fechaHoy={s.fechaReporte}
          onMarcar={onMarcar}
          onNota={onNota}
        />
      ))}
    </div>
  );
}

function GrupoSeguimiento({
  grupo,
  orden,
  token,
  fechaHoy,
  onMarcar,
  onNota,
}: {
  grupo: any;
  orden: "asc" | "desc";
  token: string;
  fechaHoy: string;
  onMarcar: (id: string, fecha: string | null) => void;
  onNota: (id: string, nota: string | null) => void;
}) {
const [page, setPage] = useState(0);
  const [copiado, setCopiado] = useState(false);
  const [copiadoTel, setCopiadoTel] = useState(false);

  const ordenes = orden === "asc" ? [...grupo.ordenes].reverse() : grupo.ordenes;
  const totalPaginas = Math.max(1, Math.ceil(ordenes.length / SEGUIMIENTO_PAGE_SIZE));
  const paginaActual = Math.min(page, totalPaginas - 1);
  const visibles = ordenes.slice(
    paginaActual * SEGUIMIENTO_PAGE_SIZE,
    paginaActual * SEGUIMIENTO_PAGE_SIZE + SEGUIMIENTO_PAGE_SIZE
  );

  const guiasDelGrupo: string[] = grupo.ordenes.map((o: any) => o.numero_guia).filter(Boolean);

  // Agrega +57 (Colombia) a cada teléfono, evitando duplicarlo si ya lo tiene
  function formatTelefonoCO(tel: string): string {
    const limpio = String(tel).replace(/\D/g, ""); // solo dígitos
    if (limpio.startsWith("57") && limpio.length > 10) return `+${limpio}`;
    return `+57${limpio}`;
  }
  const telefonosDelGrupo: string[] = grupo.ordenes
    .map((o: any) => o.telefono)
    .filter(Boolean)
    .map(formatTelefonoCO);

  async function copiarGuias() {
    try {
      await navigator.clipboard.writeText(guiasDelGrupo.join("\n"));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      alert("No se pudo copiar automáticamente. Probá con el botón de descargar.");
    }
  }

function descargarGuias() {
    const contenido = guiasDelGrupo.join("\n");
    const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `guias_${grupo.estatus.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copiarTelefonos() {
    try {
      await navigator.clipboard.writeText(telefonosDelGrupo.join("\n"));
      setCopiadoTel(true);
      setTimeout(() => setCopiadoTel(false), 1500);
    } catch {
      alert("No se pudo copiar automáticamente. Probá con el botón de descargar.");
    }
  }

  function descargarTelefonos() {
    const contenido = telefonosDelGrupo.join("\n");
    const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `telefonos_${grupo.estatus.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

async function marcarReportado(id: string, fecha: string | null) {
    onMarcar(id, fecha);
    try {
      const freshToken = await getFreshToken();
      await fetch("/api/marcar-reportado", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${freshToken}` },
        body: JSON.stringify({ id, fecha }),
      });
    } catch (err) {
      console.error("Error marcando reportado:", err);
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          background: "#334155",
          color: "white",
          fontWeight: 600,
          padding: "10px 14px",
          borderRadius: "8px 8px 0 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span>
          {grupo.estatus} — {grupo.cantidad} pedidos — desde {formatFecha(grupo.desde)} hasta{" "}
          {formatFecha(grupo.hasta)}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 400, fontSize: 13 }}>
{guiasDelGrupo.length > 0 && (
            <>
              <button onClick={copiarGuias} style={{ ...secondaryBtn, padding: "4px 10px" }}>
                {copiado ? "¡Copiado!" : `Copiar ${guiasDelGrupo.length} guías`}
              </button>
              <button onClick={descargarGuias} style={{ ...secondaryBtn, padding: "4px 10px" }}>
                Descargar guías .txt
              </button>
            </>
          )}
          {telefonosDelGrupo.length > 0 && (
            <>
              <button onClick={copiarTelefonos} style={{ ...secondaryBtn, padding: "4px 10px" }}>
                {copiadoTel ? "¡Copiado!" : `Copiar ${telefonosDelGrupo.length} teléfonos`}
              </button>
              <button onClick={descargarTelefonos} style={{ ...secondaryBtn, padding: "4px 10px" }}>
                Descargar teléfonos .txt
              </button>
            </>
          )}
          {totalPaginas > 1 && (
            <>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={paginaActual === 0}
                style={{ ...secondaryBtn, padding: "4px 10px", opacity: paginaActual === 0 ? 0.4 : 1 }}
              >
                ← Anterior
              </button>
              Página {paginaActual + 1} de {totalPaginas}
              <button
                onClick={() => setPage((p) => Math.min(totalPaginas - 1, p + 1))}
                disabled={paginaActual === totalPaginas - 1}
                style={{
                  ...secondaryBtn,
                  padding: "4px 10px",
                  opacity: paginaActual === totalPaginas - 1 ? 0.4 : 1,
                }}
              >
                Siguiente →
              </button>
            </>
          )}
        </span>
      </div>
      <div style={{ overflowX: "auto", background: "#1e293b", borderRadius: "0 0 10px 10px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
<thead>
            <tr>
              <th style={th}>Cliente</th>
              <th style={th}>Teléfono</th>
              <th style={th}>Ciudad</th>
              <th style={th}>Número guía</th>
              <th style={th}>Sin movimiento desde</th>
              <th style={th}>Días sin mov.</th>
              <th style={th}>Reportado</th>
              <th style={th}>Nota</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((o: any) => {
             const fechaReportado = o.fecha_reportado;
              const diasReportado = diasEntre(fechaReportado, fechaHoy);
              return (
                <tr key={o.id} style={{ background: colorForDias(o.dias) }}>
                  <td style={td}>{o.nombre_cliente || "-"}</td>
                  <td style={td}>{o.telefono || "-"}</td>
                  <td style={td}>{o.ciudad_destino || "-"}</td>
                  <td style={td}>{o.numero_guia || "-"}</td>
                  <td style={td}>{formatFecha(o.fecha_estatus_desde)}</td>
                  <td style={td}>{o.dias}</td>
                  <td style={td}>
                    {fechaReportado ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                        {formatFecha(fechaReportado)}
                        <span style={{ color: "#94a3b8" }}>({diasReportado}d)</span>
                        <button
                          onClick={() => marcarReportado(o.id, null)}
                          style={{ ...secondaryBtn, padding: "2px 8px", fontSize: 11 }}
                        >
                          Quitar
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => marcarReportado(o.id, fechaHoy)}
                        style={{ ...secondaryBtn, padding: "2px 8px", fontSize: 11 }}
                      >
                        Marcar hoy
                      </button>
                    )}
                  </td>
                  <td style={td}>
                    <NotaCell orderId={o.id} notaInicial={o.nota} token={token} onGuardado={onNota} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
      function NotaCell({
  orderId,
  notaInicial,
  token,
  onGuardado,
}: {
  orderId: string;
  notaInicial: string | null;
  token: string;
  onGuardado: (id: string, nota: string | null) => void;
}) {
  const [valor, setValor] = useState(notaInicial || "");
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);

async function guardar() {
    setGuardando(true);
    const nuevaNota = valor.trim() || null;
    try {
      const freshToken = await getFreshToken();
      const res = await fetch("/api/actualizar-nota", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${freshToken}` },
        body: JSON.stringify({ id: orderId, nota: nuevaNota }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(`No se pudo guardar la nota: ${json.error || res.statusText}`);
        return;
      }
      onGuardado(orderId, nuevaNota);
      setEditando(false);
    } catch {
      alert("No se pudo guardar la nota (falló la conexión). Intentá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  if (!editando) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 160 }}>
        <span style={{ color: notaInicial ? "#e2e8f0" : "#64748b", fontSize: 12 }}>
          {notaInicial || "Sin nota"}
        </span>
        <button
          onClick={() => setEditando(true)}
          style={{ ...secondaryBtn, padding: "2px 8px", fontSize: 11 }}
        >
          {notaInicial ? "Editar" : "Agregar"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 220 }}>
      <input
        type="text"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="Ej: ya pagado, retira el viernes..."
        style={{ ...selectStyle, padding: "4px 8px", fontSize: 12, flex: 1 }}
        onKeyDown={(e) => {
          if (e.key === "Enter") guardar();
        }}
        autoFocus
      />
      <button onClick={guardar} disabled={guardando} style={{ ...secondaryBtn, padding: "2px 8px", fontSize: 11 }}>
        {guardando ? "..." : "Guardar"}
      </button>
    </div>
  );
}
function EstatusTab({ data }: any) {
  const b = data.buckets;
  const [selected, setSelected] = useState<string>("__todas__");
  const [sortBy, setSortBy] = useState<string>("total");

  const ciudadesFiltradas =
    selected === "__todas__" ? data.porCiudad : data.porCiudad.filter((c: any) => c.ciudad === selected);
  const ciudades = [...ciudadesFiltradas].sort((a: any, b: any) => b[sortBy] - a[sortBy]);

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

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0 12px", flexWrap: "wrap" }}>
        <h3 style={{ ...h3, margin: 0 }}>Por ciudad destino</h3>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} style={selectStyle}>
          <option value="__todas__">Todas las ciudades</option>
          {data.porCiudad.map((c: any) => (
            <option key={c.ciudad} value={c.ciudad}>
              {c.ciudad}
            </option>
          ))}
        </select>
        <span style={{ color: "#94a3b8", fontSize: 13 }}>Ordenar por:</span>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={selectStyle}>
          <option value="total">Total</option>
          <option value="entregado">Entregado</option>
          <option value="devolucion">Devolución</option>
          <option value="cancelado">Cancelado</option>
          <option value="en_transito">En tránsito</option>
        </select>
      </div>
      <Table
        headers={["Ciudad", "Entregado", "Devolución", "Cancelado", "En tránsito", "Total"]}
        rows={ciudades.map((c: any) => [
          c.ciudad,
          pctCell(c.entregado, c.total),
          pctCell(c.devolucion, c.total),
          pctCell(c.cancelado, c.total),
          pctCell(c.en_transito, c.total),
          c.total,
        ])}
      />
    </div>
  );
}

function TransportadorasTab({ data }: any) {
  const [selected, setSelected] = useState<string>("__todas__");
  const [transporSeleccionada, setTransporSeleccionada] = useState<string>("__global__");

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

  const gruposAMostrar =
    selected === "__todas__" ? groupedByCiudad : groupedByCiudad.filter((g) => g.ciudad === selected);

  const histogramaAMostrar =
    transporSeleccionada === "__global__"
      ? data.fleteGlobal.histograma
      : data.transportadoras.find((t: any) => t.transportadora === transporSeleccionada)?.histogramaFlete || [];

  return (
    <div>
      <h3 style={h3}>Costo de flete de la operación</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 12 }}>
<FleteStatCard label="Flete promedio" value={data.fleteGlobal.promedio} color="#3b82f6" />
        <FleteStatCard label="Flete mínimo" value={data.fleteGlobal.minimo} color="#22c55e" />
        <FleteStatCard label="Flete máximo" value={data.fleteGlobal.maximo} color="#f97316" />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4, flexWrap: "wrap" }}>
        <span style={{ color: "#94a3b8", fontSize: 13 }}>Distribución de:</span>
        <select
          value={transporSeleccionada}
          onChange={(e) => setTransporSeleccionada(e.target.value)}
          style={selectStyle}
        >
          <option value="__global__">Toda la operación</option>
          {data.transportadoras.map((t: any) => (
            <option key={t.transportadora} value={t.transportadora}>
              {t.transportadora}
            </option>
          ))}
        </select>
      </div>
      <div style={{ background: "#1e293b", borderRadius: 10, padding: 16, marginBottom: 32 }}>
        <HistogramaChart data={histogramaAMostrar} />
      </div>

      <h3 style={h3}>Efectividad por transportadora</h3>
      <Table
        headers={["Transportadora", "Enviados", "Entregados", "%", "Devueltos", "%", "En tránsito", "%", "Flete prom."]}
        rows={data.transportadoras.map((t: any) => [
          t.transportadora,
          t.enviados,
          t.entregados,
          `${t.entregadosPct}%`,
          t.devueltos,
          `${t.devueltosPct}%`,
          t.enTransito,
          `${t.enTransitoPct}%`,
          t.fleteProm !== null ? money(t.fleteProm) : "-",
        ])}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0 12px" }}>
        <h3 style={{ ...h3, margin: 0 }}>Cruce transportadora × ciudad</h3>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} style={selectStyle}>
          <option value="__todas__">Todas las ciudades</option>
          {groupedByCiudad.map((g) => (
            <option key={g.ciudad} value={g.ciudad}>
              {g.ciudad}
            </option>
          ))}
        </select>
      </div>

      {gruposAMostrar.map((g) => (
        <div key={g.ciudad} style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, color: "#93c5fd", margin: "12px 0 6px" }}>
            {g.ciudad} — {g.total} pedidos
          </div>
          <Table
            headers={["Transportadora", "Entregado", "Devolución", "En tránsito", "Total"]}
            rows={g.rows.map((t: any) => [
              t.transportadora,
              pctCell(t.entregado, t.total),
              pctCell(t.devolucion, t.total),
              pctCell(t.en_transito, t.total),
              t.total,
            ])}
          />
        </div>
      ))}
    </div>
  );
}

function FleteStatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#1e293b", borderRadius: 10, padding: 16, borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 13, color: "#94a3b8" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{money(value)}</div>
    </div>
  );
}

function HistogramaChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <p style={{ color: "#64748b", fontSize: 13 }}>No hay datos suficientes para mostrar la distribución.</p>;
  }
  const max = Math.max(...data.map((d) => d.cantidad));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 160 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }} title={`${money(d.desde)} - ${money(d.hasta)}: ${d.cantidad} órdenes`}>
            <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>{d.cantidad}</div>
            <div
              style={{
                width: "100%",
                height: max ? `${Math.max(2, (d.cantidad / max) * 130)}px` : 2,
                background: "#3b82f6",
                borderRadius: "3px 3px 0 0",
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginTop: 6 }}>
        <span>{money(data[0].desde)}</span>
        <span>{money(data[data.length - 1].hasta)}</span>
      </div>
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
        <MoneyCard label="📦 Próximo a entregar (1-2 días)" value={d.proximo_a_entregar.suma} count={d.proximo_a_entregar.cantidad} color="#a855f7" />
        <MoneyCard label="🔁 Ajuste por devoluciones" value={d.devolucion.suma} count={d.devolucion.cantidad} color="#f97316" />
      </div>
      <p style={{ color: "#64748b", fontSize: 13, marginTop: 20 }}>
        Ganancia = Valor de compra en productos − Precio flete − Total precios proveedor
        (en devoluciones, además se resta el costo de flete de devolución).
        <br />
        "Próximo a entregar" suma las órdenes en estatus: en reparto, en bodega destino,
        intento de entrega, reclame en oficina, en punto droop, en terminal destino,
        en bodega transportadora y en procesamiento — ya está incluido dentro del total
        "en tránsito", es un subconjunto para ver qué tan cerca está de cobrarse.
      </p>
    </div>
  );
}

function ProductoTab({ data }: any) {
  const productos = data.productoResumen;
  const [selected, setSelected] = useState<string>("__todos__");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const grouped = new Map<string, any[]>();
  for (const pc of data.productoCiudad) {
    if (!grouped.has(pc.producto)) grouped.set(pc.producto, []);
    grouped.get(pc.producto)!.push(pc);
  }

  const transGrouped = new Map<string, any[]>();
  for (const t of data.productoCiudadTransportadora || []) {
    const key = `${t.producto}__${t.ciudad}`;
    if (!transGrouped.has(key)) transGrouped.set(key, []);
    transGrouped.get(key)!.push(t);
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
          pctCell(p.entregado, p.total),
          pctCell(p.devolucion, p.total),
          pctCell(p.cancelado, p.total),
          pctCell(p.en_transito, p.total),
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
            <div style={{ overflowX: "auto", marginBottom: 32, background: "#1e293b", borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={th}>Ciudad</th>
                    <th style={th}>Entregado</th>
                    <th style={th}>Devolución</th>
                    <th style={th}>Cancelado</th>
                    <th style={th}>En tránsito</th>
                    <th style={th}>Total</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c: any) => {
                    const key = `${p.producto}__${c.ciudad}`;
                    const isOpen = expandedKey === key;
                    const transportadoras = (transGrouped.get(key) || []).sort(
                      (a: any, b: any) =>
                        b.entregado + b.devolucion + b.cancelado + b.en_transito -
                        (a.entregado + a.devolucion + a.cancelado + a.en_transito)
                    );
                    return (
                      <Fragment key={key}>
                        <tr key={key} style={{ borderTop: "1px solid #334155" }}>
                          <td style={td}>{c.ciudad}</td>
                          <td style={td}>{pctCell(c.entregado, c.total)}</td>
                          <td style={td}>{pctCell(c.devolucion, c.total)}</td>
                          <td style={td}>{pctCell(c.cancelado, c.total)}</td>
                          <td style={td}>{pctCell(c.en_transito, c.total)}</td>
                          <td style={td}>{c.total}</td>
                          <td style={td}>
                            <button
                              onClick={() => setExpandedKey(isOpen ? null : key)}
                              style={{ ...selectStyle, cursor: "pointer" }}
                            >
                              {isOpen ? "▲ Ocultar transportadoras" : "▼ Ver transportadoras"}
                            </button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={key + "_exp"}>
                            <td style={{ ...td, padding: 0 }} colSpan={7}>
                              <div style={{ padding: "8px 12px 16px 24px", background: "#0f172a" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                  <thead>
                                    <tr>
                                      <th style={th}>Transportadora</th>
                                      <th style={th}>Entregado</th>
                                      <th style={th}>Devolución</th>
                                      <th style={th}>Cancelado</th>
                                      <th style={th}>En tránsito</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {transportadoras.length === 0 && (
                                      <tr>
                                        <td style={td} colSpan={5}>
                                          Sin datos.
                                        </td>
                                      </tr>
                                    )}
                                    {transportadoras.map((t: any) => (
                                      <tr key={t.transportadora} style={{ borderTop: "1px solid #334155" }}>
                                        <td style={td}>{t.transportadora}</td>
                                        <td style={td}>{t.entregado}</td>
                                        <td style={td}>{t.devolucion}</td>
                                        <td style={td}>{t.cancelado}</td>
                                        <td style={td}>{t.en_transito}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HistorialEstatusTab({ data }: any) {
  const [seleccionados, setSeleccionados] = useState<string[]>(data.todosLosEstatus);

  function toggle(estatus: string) {
    setSeleccionados((prev) =>
      prev.includes(estatus) ? prev.filter((e) => e !== estatus) : [...prev, estatus]
    );
  }

  function marcarTodos() {
    setSeleccionados(data.todosLosEstatus);
  }

  function desmarcarTodos() {
    setSeleccionados([]);
  }

  // Agrupamos por fecha, solo con los estatus seleccionados
  const porFecha = new Map<string, Map<string, number>>();
  for (const r of data.estatusPorDia) {
    if (!seleccionados.includes(r.estatus)) continue;
    if (!porFecha.has(r.fecha)) porFecha.set(r.fecha, new Map());
    porFecha.get(r.fecha)!.set(r.estatus, r.cantidad);
  }
  const fechasOrdenadas = Array.from(porFecha.keys()).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div>
      <p style={{ color: "#94a3b8", marginBottom: 16 }}>
        Muestra, día por día, cuántas órdenes entraron a cada estatus (según la fecha
        en que cambiaron a su estatus actual). Elegí qué estatus ver.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button onClick={marcarTodos} style={{ ...secondaryBtn, padding: "4px 10px" }}>
          Marcar todos
        </button>
        <button onClick={desmarcarTodos} style={{ ...secondaryBtn, padding: "4px 10px" }}>
          Desmarcar todos
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px 16px",
          background: "#1e293b",
          borderRadius: 10,
          padding: 16,
          marginBottom: 24,
        }}
      >
        {data.todosLosEstatus.map((estatus: string) => (
          <label key={estatus} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={seleccionados.includes(estatus)}
              onChange={() => toggle(estatus)}
            />
            {estatus}
          </label>
        ))}
      </div>

{seleccionados.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: 13 }}>Elegí al menos un estatus para ver la tabla.</p>
      ) : (
        <div style={{ overflowX: "auto", background: "#1e293b", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>Fecha</th>
                {seleccionados.map((estatus) => (
                  <th key={estatus} style={th}>
                    {estatus}
                  </th>
                ))}
                <th style={th}>Total</th>
              </tr>
            </thead>
            <tbody>
              {fechasOrdenadas.map((fecha) => {
                const fila = porFecha.get(fecha)!;
                const totalFila = seleccionados.reduce((s, e) => s + (fila.get(e) || 0), 0);
                return (
                  <tr key={fecha}>
                    <td style={td}>{formatFecha(fecha)}</td>
                    {seleccionados.map((estatus) => (
                      <td key={estatus} style={td}>
                        {fila.get(estatus) || 0}
                      </td>
                    ))}
                    <td style={{ ...td, fontWeight: 700 }}>{totalFila}</td>
                  </tr>
                );
              })}
              <tr style={{ background: "#334155", fontWeight: 700 }}>
                <td style={td}>TOTAL</td>
                {seleccionados.map((estatus) => {
                  const totalEstatus = fechasOrdenadas.reduce(
                    (s, fecha) => s + (porFecha.get(fecha)!.get(estatus) || 0),
                    0
                  );
                  return (
                    <td key={estatus} style={td}>
                      {totalEstatus}
                    </td>
                  );
                })}
                <td style={td}>
                  {fechasOrdenadas.reduce(
                    (s, fecha) => s + seleccionados.reduce((s2, e) => s2 + (porFecha.get(fecha)!.get(e) || 0), 0),
                    0
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProductividadTab({ data }: any) {
  const totalHoy = data.confirmacionesPorVendedorHoy.reduce((s: number, v: any) => s + v.cantidad, 0);

  // Agrupamos por fecha para poder mostrar un total al final de cada día
  const porDiaGrouped = new Map<string, { vendedor: string; cantidad: number }[]>();
  for (const v of data.confirmacionesPorVendedorPorDia) {
    if (!porDiaGrouped.has(v.fecha)) porDiaGrouped.set(v.fecha, []);
    porDiaGrouped.get(v.fecha)!.push({ vendedor: v.vendedor, cantidad: v.cantidad });
  }
  const fechasOrdenadas = Array.from(porDiaGrouped.keys()).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div>
      <h3 style={h3}>Confirmadas hoy — {formatFecha(data.fechaReporteMaxProductividad)}</h3>
      {data.confirmacionesPorVendedorHoy.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: 13, marginBottom: 24 }}>
          Nadie confirmó órdenes nuevas en el último reporte cargado.
        </p>
      ) : (
        <div style={{ overflowX: "auto", marginBottom: 32, background: "#1e293b", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>Vendedor</th>
                <th style={th}>Órdenes confirmadas hoy</th>
              </tr>
            </thead>
            <tbody>
              {data.confirmacionesPorVendedorHoy.map((v: any) => (
                <tr key={v.vendedor}>
                  <td style={td}>{v.vendedor}</td>
                  <td style={td}>{v.cantidad}</td>
                </tr>
              ))}
              <tr style={{ background: "#334155", fontWeight: 700 }}>
                <td style={td}>TOTAL</td>
                <td style={td}>{totalHoy}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <h3 style={h3}>Órdenes confirmadas por vendedor (histórico acumulado)</h3>
      <div style={{ marginBottom: 32 }}>
        <Table
          headers={["Vendedor", "Órdenes confirmadas"]}
          rows={data.confirmacionesPorVendedor.map((v: any) => [v.vendedor, v.cantidad])}
        />
      </div>

      <h3 style={h3}>Historial día por día</h3>
      <div style={{ overflowX: "auto", marginBottom: 32, background: "#1e293b", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th}>Fecha</th>
              <th style={th}>Vendedor</th>
              <th style={th}>Órdenes confirmadas</th>
            </tr>
          </thead>
          <tbody>
            {fechasOrdenadas.map((fecha) => {
              const filas = [...porDiaGrouped.get(fecha)!].sort((a, b) => b.cantidad - a.cantidad);
              const totalDia = filas.reduce((s, f) => s + f.cantidad, 0);
              return (
                <Fragment key={fecha}>
                  {filas.map((f, i) => (
                    <tr key={fecha + f.vendedor}>
                      <td style={td}>{i === 0 ? formatFecha(fecha) : ""}</td>
                      <td style={td}>{f.vendedor}</td>
                      <td style={td}>{f.cantidad}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "#334155", fontWeight: 700 }}>
                    <td style={td}></td>
                    <td style={td}>TOTAL {formatFecha(fecha)}</td>
                    <td style={td}>{totalDia}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TagsTab({ data }: any) {
  const todasLasCiudades = Array.from(
    new Set(data.tagsResumen.flatMap((t: any) => t.porCiudad.map((c: any) => c.ciudad)))
  ).sort() as string[];
  const [selected, setSelected] = useState<string>("__todas__");

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <span style={{ color: "#94a3b8", fontSize: 13 }}>Filtrar por ciudad:</span>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} style={selectStyle}>
          <option value="__todas__">Todas las ciudades</option>
          {todasLasCiudades.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {data.tagsResumen.map((t: any) => {
        const filas =
          selected === "__todas__" ? t.porCiudad : t.porCiudad.filter((c: any) => c.ciudad === selected);
        return (
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
              rows={filas.map((c: any) => [
                c.ciudad,
                pctCell(c.entregado, c.total),
                pctCell(c.devolucion, c.total),
                pctCell(c.enTransito, c.total),
                c.total,
              ])}
            />
          </div>
        );
      })}
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

    const DIAS_PAGE_SIZE = 50;

function DiasPendientesTab({ data, token, onMarcar, onNota }: any) {
  const dias: any[] = data.diasPendientes || [];
  const [estatusExcluidos, setEstatusExcluidos] = useState<string[]>([]);
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");
  const [diaAbierto, setDiaAbierto] = useState<string | null>(null);

  // Todos los estatus presentes en los días pendientes (para el filtro)
  const todosLosEstatus = Array.from(
    new Set(dias.flatMap((d) => d.ordenes.map((o: any) => (o.estatus_actual || "SIN ESTATUS").trim())))
  ).sort() as string[];

  function toggleEstatus(e: string) {
    setEstatusExcluidos((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  }

  // Aplicamos los dos filtros: rango de fechas + estatus excluidos
  const diasFiltrados = dias
    .filter((d) => {
      if (desde && d.fecha < desde) return false;
      if (hasta && d.fecha > hasta) return false;
      return true;
    })
    .map((d) => ({
      ...d,
      ordenes: d.ordenes.filter(
        (o: any) => !estatusExcluidos.includes((o.estatus_actual || "SIN ESTATUS").trim())
      ),
    }))
    .filter((d) => d.ordenes.length > 0);

  const totalPedidos = diasFiltrados.reduce((s, d) => s + d.ordenes.length, 0);

  return (
    <div>
      <p style={{ color: "#94a3b8", marginBottom: 16 }}>
        Agrupa los pedidos por el día en que se hicieron. Un día queda "cerrado" cuando ya no
        le queda ningún pedido en un estatus abierto. Hacé clic en una fila para ver el detalle.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ color: "#94a3b8", fontSize: 13 }}>Desde:</span>
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={selectStyle} />
        <span style={{ color: "#94a3b8", fontSize: 13 }}>Hasta:</span>
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={selectStyle} />
        {(desde || hasta) && (
          <button
            onClick={() => {
              setDesde("");
              setHasta("");
            }}
            style={{ ...secondaryBtn, padding: "4px 10px" }}
          >
            Limpiar fechas
          </button>
        )}
      </div>

      <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: "#94a3b8", fontSize: 13 }}>Excluir estatus:</span>
        {estatusExcluidos.length > 0 && (
          <button onClick={() => setEstatusExcluidos([])} style={{ ...secondaryBtn, padding: "4px 10px" }}>
            Limpiar ({estatusExcluidos.length})
          </button>
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px 16px",
          background: "#1e293b",
          borderRadius: 10,
          padding: 16,
          marginBottom: 24,
        }}
      >
        {todosLosEstatus.map((e) => (
          <label key={e} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={estatusExcluidos.includes(e)} onChange={() => toggleEstatus(e)} />
            {e}
          </label>
        ))}
      </div>

      <div style={{ overflowX: "auto", background: "#1e293b", borderRadius: 10, marginBottom: 24 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th}>Fecha</th>
              <th style={th}>Pedidos pendientes</th>
              <th style={th}>% del total</th>
              <th style={th}>Estado</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {diasFiltrados.map((d) => {
              const abierto = diaAbierto === d.fecha;
              const pct = totalPedidos ? Math.round((d.ordenes.length / totalPedidos) * 1000) / 10 : 0;
              return (
                <Fragment key={d.fecha}>
                  <tr
                    onClick={() => setDiaAbierto(abierto ? null : d.fecha)}
                    style={{ cursor: "pointer", borderTop: "1px solid #334155" }}
                  >
                    <td style={{ ...td, fontWeight: 600 }}>{formatFecha(d.fecha)}</td>
                    <td style={td}>{d.ordenes.length}</td>
                    <td style={td}>{pct}%</td>
                    <td style={td}>
                      {d.cerrado ? (
                        <span style={{ color: "#86efac" }}>✓ Cerrado</span>
                      ) : (
                        <span style={{ color: "#fbbf24" }}>Pendiente</span>
                      )}
                    </td>
                    <td style={td}>{abierto ? "▲ Ocultar" : "▼ Ver detalle"}</td>
                  </tr>
                  {abierto && (
                    <tr>
                      <td colSpan={5} style={{ ...td, padding: 0, background: "#0f172a" }}>
                        <div style={{ padding: 16 }}>
                          <DetalleDia dia={d} token={token} onMarcar={onMarcar} onNota={onNota} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            <tr style={{ background: "#334155", fontWeight: 700 }}>
              <td style={td}>TOTAL</td>
              <td style={td}>{totalPedidos}</td>
              <td style={td}>100%</td>
              <td style={td}>{diasFiltrados.length} días</td>
              <td style={td}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetalleDia({ dia, token, onMarcar, onNota }: any) {
  // Agrupamos los pedidos de este día por estatus
  const porEstatus = new Map<string, any[]>();
  for (const o of dia.ordenes) {
    const e = (o.estatus_actual || "SIN ESTATUS").trim();
    if (!porEstatus.has(e)) porEstatus.set(e, []);
    porEstatus.get(e)!.push(o);
  }
  const grupos = Array.from(porEstatus.entries()).sort((a, b) => b[1].length - a[1].length);

  return (
    <div>
      {grupos.map(([estatus, ordenes]) => (
        <GrupoDiaPendiente
          key={estatus}
          dia={{ ...dia, ordenes, estatusLabel: estatus }}
          token={token}
          onMarcar={onMarcar}
          onNota={onNota}
        />
      ))}
    </div>
  );
}

function GrupoDiaPendiente({ dia, token, onMarcar, onNota }: any) {
  const [page, setPage] = useState(0);
  const [copiado, setCopiado] = useState(false);
  const [copiadoTel, setCopiadoTel] = useState(false);

  const totalPaginas = Math.max(1, Math.ceil(dia.ordenes.length / DIAS_PAGE_SIZE));
  const paginaActual = Math.min(page, totalPaginas - 1);
  const visibles = dia.ordenes.slice(
    paginaActual * DIAS_PAGE_SIZE,
    paginaActual * DIAS_PAGE_SIZE + DIAS_PAGE_SIZE
  );

  const guiasDelDia: string[] = dia.ordenes.map((o: any) => o.numero_guia).filter(Boolean);

  function formatTelefonoCO(tel: string): string {
    const limpio = String(tel).replace(/\D/g, "");
    if (limpio.startsWith("57") && limpio.length > 10) return `+${limpio}`;
    return `+57${limpio}`;
  }
  const telefonosDelDia: string[] = dia.ordenes
    .map((o: any) => o.telefono)
    .filter(Boolean)
    .map(formatTelefonoCO);

  async function copiarGuias() {
    try {
      await navigator.clipboard.writeText(guiasDelDia.join("\n"));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      alert("No se pudo copiar automáticamente. Probá con el botón de descargar.");
    }
  }
  function descargarGuias() {
    const blob = new Blob([guiasDelDia.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `guias_${dia.fecha}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function copiarTelefonos() {
    try {
      await navigator.clipboard.writeText(telefonosDelDia.join("\n"));
      setCopiadoTel(true);
      setTimeout(() => setCopiadoTel(false), 1500);
    } catch {
      alert("No se pudo copiar automáticamente. Probá con el botón de descargar.");
    }
  }
  function descargarTelefonos() {
    const blob = new Blob([telefonosDelDia.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `telefonos_${dia.fecha}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function marcarReportado(id: string, fecha: string | null) {
    const anterior = dia.ordenes.find((o: any) => o.id === id)?.fecha_reportado ?? null;
    onMarcar(id, fecha);
    try {
      const res = await fetch("/api/marcar-reportado", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, fecha }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(`No se pudo guardar la marca: ${json.error || res.statusText}`);
        onMarcar(id, anterior);
      }
    } catch {
      alert("No se pudo guardar la marca (falló la conexión). Intentá de nuevo.");
      onMarcar(id, anterior);
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          background: "#334155",
          color: "white",
          fontWeight: 600,
          padding: "10px 14px",
          borderRadius: "8px 8px 0 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
                <span>
          {dia.estatusLabel ? `${dia.estatusLabel} — ` : ""}
          {dia.ordenes.length} pedidos — {formatFecha(dia.fecha)}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 400, fontSize: 13 }}>
          {guiasDelDia.length > 0 && (
            <>
              <button onClick={copiarGuias} style={{ ...secondaryBtn, padding: "4px 10px" }}>
                {copiado ? "¡Copiado!" : `Copiar ${guiasDelDia.length} guías`}
              </button>
              <button onClick={descargarGuias} style={{ ...secondaryBtn, padding: "4px 10px" }}>
                Descargar guías .txt
              </button>
            </>
          )}
          {telefonosDelDia.length > 0 && (
            <>
              <button onClick={copiarTelefonos} style={{ ...secondaryBtn, padding: "4px 10px" }}>
                {copiadoTel ? "¡Copiado!" : `Copiar ${telefonosDelDia.length} teléfonos`}
              </button>
              <button onClick={descargarTelefonos} style={{ ...secondaryBtn, padding: "4px 10px" }}>
                Descargar teléfonos .txt
              </button>
            </>
          )}
          {totalPaginas > 1 && (
            <>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={paginaActual === 0}
                style={{ ...secondaryBtn, padding: "4px 10px", opacity: paginaActual === 0 ? 0.4 : 1 }}
              >
                ← Anterior
              </button>
              Página {paginaActual + 1} de {totalPaginas}
              <button
                onClick={() => setPage((p) => Math.min(totalPaginas - 1, p + 1))}
                disabled={paginaActual === totalPaginas - 1}
                style={{
                  ...secondaryBtn,
                  padding: "4px 10px",
                  opacity: paginaActual === totalPaginas - 1 ? 0.4 : 1,
                }}
              >
                Siguiente →
              </button>
            </>
          )}
        </span>
      </div>
      <div style={{ overflowX: "auto", background: "#1e293b", borderRadius: "0 0 10px 10px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th}>Número guía</th>
              <th style={th}>Cliente</th>
              <th style={th}>Teléfono</th>
              <th style={th}>Ciudad</th>
              <th style={th}>Estatus</th>
              <th style={th}>Reportado</th>
              <th style={th}>Nota</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((o: any) => (
              <tr key={o.id}>
                <td style={td}>{o.numero_guia || "-"}</td>
                <td style={td}>{o.nombre_cliente || "-"}</td>
                <td style={td}>{o.telefono || "-"}</td>
                <td style={td}>{o.ciudad_destino || "-"}</td>
                <td style={td}>{o.estatus_actual || "-"}</td>
                <td style={td}>
                  {o.fecha_reportado ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                      {formatFecha(o.fecha_reportado)}
                      <button
                        onClick={() => marcarReportado(o.id, null)}
                        style={{ ...secondaryBtn, padding: "2px 8px", fontSize: 11 }}
                      >
                        Quitar
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => marcarReportado(o.id, dia.fecha)}
                      style={{ ...secondaryBtn, padding: "2px 8px", fontSize: 11 }}
                    >
                      Marcar hoy
                    </button>
                  )}
                </td>
                <td style={td}>
                  <NotaCell orderId={o.id} notaInicial={o.nota} token={token} onGuardado={onNota} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
const COLORES_TORTA = ["#3b82f6", "#22c55e", "#f97316", "#a855f7", "#eab308", "#ef4444", "#14b8a6", "#ec4899"];

const COLOR_TRANSPORTADORA: Record<string, string> = {
  "ENVIA": "#ef4444",
  "COORDINADORA": "#3b82f6",
  "TCC": "#f97316",
  "VELOCES": "#ec4899",
  "INTERRAPIDISIMO": "#22c55e",
  "JAMV-DRIVE": "#a855f7",
};
function colorTransportadora(nombre: string, i: number) {
  return COLOR_TRANSPORTADORA[(nombre || "").trim().toUpperCase()] || COLORES_TORTA[i % COLORES_TORTA.length];
}
function GeneralTab({ data }: any) {
  const b = data.buckets;
  const d = data.dinero;
  const dias: any[] = data.diasPendientes || [];

  // Mes a mostrar en el calendario: el más reciente que tenga días
  const mesesDeDias = Array.from(new Set(dias.map((x: any) => x.fecha.slice(0, 7)))).sort() as string[];
  const [mesCal, setMesCal] = useState<string>(mesesDeDias[mesesDeDias.length - 1] || "");

  return (
    <div>
      <h3 style={h3}>Resumen general</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        <StatCard label="✅ Entregado" count={b.entregado.count} pctVal={b.entregado.pct} color="#22c55e" />
        <StatCard label="🚚 En tránsito" count={b.en_transito.count} pctVal={b.en_transito.pct} color="#3b82f6" />
        <StatCard label="🔁 Devolución" count={b.devolucion.count} pctVal={b.devolucion.pct} color="#f97316" />
        <StatCard label="🚫 Cancelado" count={b.cancelado.count} pctVal={b.cancelado.pct} color="#ef4444" />
      </div>

      <h3 style={h3}>Dinero</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
        <MoneyCard label="💰 Ganancia realizada" value={d.entregado.suma} count={d.entregado.cantidad} color="#22c55e" />
        <MoneyCard label="🚚 Ganancia en camino" value={d.en_transito.suma} count={d.en_transito.cantidad} color="#3b82f6" />
        <MoneyCard label="📦 Próximo a entregar" value={d.proximo_a_entregar.suma} count={d.proximo_a_entregar.cantidad} color="#a855f7" />
        <MoneyCard label="🔁 Ajuste devoluciones" value={d.devolucion.suma} count={d.devolucion.cantidad} color="#f97316" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 24, marginBottom: 32 }}>
        <div>
          <h3 style={h3}>Top 10 ciudades</h3>
          <Table
            headers={["Ciudad", "Total", "Entregado", "Devolución", "Cancelado"]}
            rows={data.porCiudad.slice(0, 10).map((c: any) => [
              c.ciudad,
              c.total,
              pctCell(c.entregado, c.total),
              pctCell(c.devolucion, c.total),
              pctCell(c.cancelado, c.total),
            ])}
          />
        </div>
        <div>
          <h3 style={h3}>Transportadoras</h3>
          <TortaTransportadoras transportadoras={data.transportadoras} />
        </div>
      </div>

        <h3 style={h3}>Novedades</h3>
      <Noticias noticias={data.noticias || []} />
      
      <h3 style={h3}>Desempeño por transportadora</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 32 }}>
        {(data.transportadoras || []).map((t: any, i: number) => (
          <TortaEstadoTransportadora key={t.transportadora} t={t} idx={i} />
        ))}
      </div>

        <h3 style={h3}>Mapa de Colombia</h3>
      <MapaColombia
        porDepartamento={data.porDepartamento}
        novedadesPorDepartamento={data.novedadesPorDepartamento || []}
      />

       <h3 style={h3}>Novedades nuevas por día</h3>
      <NovedadesPorDia dias={data.novedadesPorDia || []} />

      <h3 style={h3}>Por departamento</h3>
      <div style={{ marginBottom: 32 }}>
        <Table
          headers={["Departamento", "Envíos", "% Entregado", "% Devolución", "% Cancelado"]}
          rows={(data.porDepartamento || []).map((x: any) => [
            x.departamento,
            x.total,
            `${x.pctEntregado}%`,
            `${x.pctDevolucion}%`,
            `${x.pctCancelado}%`,
          ])}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 12px" }}>
        <h3 style={{ ...h3, margin: 0 }}>Calendario de cierre</h3>
        <select value={mesCal} onChange={(e) => setMesCal(e.target.value)} style={selectStyle}>
          {mesesDeDias.map((m) => (
            <option key={m} value={m}>
              {nombreMes(m)}
            </option>
          ))}
        </select>
      </div>
      <CalendarioCierre dias={dias} mes={mesCal} />
    </div>
  );
}

function NovedadesPorDia({ dias }: any) {
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");

  if (!dias || dias.length === 0) {
    return <p style={{ color: "#64748b", fontSize: 13, marginBottom: 32 }}>Sin novedades registradas.</p>;
  }

  const hayFiltro = desde || hasta;
  // Sin filtro: solo los últimos 20 días. Con filtro: lo que entre en el rango.
  const filtrados = hayFiltro
    ? dias.filter((d: any) => {
        if (desde && d.fecha < desde) return false;
        if (hasta && d.fecha > hasta) return false;
        return true;
      })
    : dias.slice(0, 20);

  const total = filtrados.reduce((s: number, d: any) => s + d.cantidad, 0);

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ color: "#94a3b8", fontSize: 13 }}>Desde:</span>
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={selectStyle} />
        <span style={{ color: "#94a3b8", fontSize: 13 }}>Hasta:</span>
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={selectStyle} />
        {hayFiltro && (
          <button
            onClick={() => {
              setDesde("");
              setHasta("");
            }}
            style={{ ...secondaryBtn, padding: "4px 10px" }}
          >
            Ver últimos 20 días
          </button>
        )}
        {!hayFiltro && (
          <span style={{ color: "#64748b", fontSize: 12 }}>
            Mostrando los últimos 20 días — elegí un rango para ver más.
          </span>
        )}
      </div>

      <div style={{ overflowX: "auto", background: "#1e293b", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th}>Fecha</th>
              <th style={th}>Novedades nuevas</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((d: any) => (
              <tr key={d.fecha}>
                <td style={td}>{formatFecha(d.fecha)}</td>
                <td style={td}>{d.cantidad}</td>
              </tr>
            ))}
            <tr style={{ background: "#334155", fontWeight: 700 }}>
              <td style={td}>TOTAL ({filtrados.length} días)</td>
              <td style={td}>{total}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
      
    function TortaTransportadoras({ transportadoras }: any) {
  const datos = (transportadoras || []).slice(0, 8).map((t: any) => ({
    nombre: t.transportadora,
    valor: t.enviados,
  }));
  const total = datos.reduce((s: number, x: any) => s + x.valor, 0);
  if (!total) return <p style={{ color: "#64748b", fontSize: 13 }}>Sin datos.</p>;

  let anguloAcum = 0;
  const radio = 90;
  const cx = 100;
  const cy = 100;

  const paths = datos.map((x: any, i: number) => {
    const porcion = x.valor / total;
    const a0 = anguloAcum;
    const a1 = anguloAcum + porcion * 2 * Math.PI;
    anguloAcum = a1;
    const x0 = cx + radio * Math.cos(a0 - Math.PI / 2);
    const y0 = cy + radio * Math.sin(a0 - Math.PI / 2);
    const x1 = cx + radio * Math.cos(a1 - Math.PI / 2);
    const y1 = cy + radio * Math.sin(a1 - Math.PI / 2);
    const largo = porcion > 0.5 ? 1 : 0;
    return {
      d: `M ${cx} ${cy} L ${x0} ${y0} A ${radio} ${radio} 0 ${largo} 1 ${x1} ${y1} Z`,
           color: colorTransportadora(x.nombre, i),
      nombre: x.nombre,
      valor: x.valor,
      pct: Math.round(porcion * 1000) / 10,
    };
  });

  return (
    <div style={{ background: "#1e293b", borderRadius: 10, padding: 16, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
      <svg viewBox="0 0 200 200" style={{ width: 200, height: 200, flexShrink: 0 }}>
        {paths.map((p: any, i: number) => (
          <path key={i} d={p.d} fill={p.color} stroke="#1e293b" strokeWidth="1" />
        ))}
      </svg>
      <div style={{ fontSize: 13, flex: 1, minWidth: 160 }}>
        {paths.map((p: any, i: number) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ width: 12, height: 12, background: p.color, borderRadius: 3, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{p.nombre}</span>
            <span style={{ color: "#94a3b8" }}>
              {p.valor} ({p.pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarioCierre({ dias, mes }: { dias: any[]; mes: string }) {
  if (!mes) return <p style={{ color: "#64748b", fontSize: 13 }}>Sin datos.</p>;

  const porFecha = new Map<string, any>();
  for (const d of dias) porFecha.set(d.fecha, d);

  const [anio, mesNum] = mes.split("-").map(Number);
  const primerDia = new Date(anio, mesNum - 1, 1);
  const diasEnMes = new Date(anio, mesNum, 0).getDate();
  const offset = (primerDia.getDay() + 6) % 7; // lunes = 0

  const celdas: (string | null)[] = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let dd = 1; dd <= diasEnMes; dd++) {
    celdas.push(`${mes}-${String(dd).padStart(2, "0")}`);
  }

  return (
    <div style={{ background: "#1e293b", borderRadius: 10, padding: 16, marginBottom: 32 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", fontWeight: 600, paddingBottom: 4 }}>
            {d}
          </div>
        ))}
        {celdas.map((fecha, i) => {
          if (!fecha) return <div key={`v${i}`} />;
          const info = porFecha.get(fecha);
          const numero = Number(fecha.slice(-2));
          if (!info) {
            return (
              <div key={fecha} style={{ background: "#0f172a", borderRadius: 6, padding: 8, minHeight: 62, color: "#475569", fontSize: 12 }}>
                {numero}
              </div>
            );
          }
          const cerrado = info.cerrado;
          return (
            <div
              key={fecha}
              style={{
                background: cerrado ? "rgba(34, 197, 94, 0.18)" : "rgba(59, 130, 246, 0.18)",
                border: `1px solid ${cerrado ? "rgba(34,197,94,0.5)" : "rgba(59,130,246,0.5)"}`,
                borderRadius: 6,
                padding: 8,
                minHeight: 62,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700 }}>{numero}</div>
              {cerrado ? (
                <div style={{ fontSize: 11, color: "#86efac", marginTop: 2 }}>✓ Cerrado</div>
              ) : (
                <div style={{ fontSize: 11, color: "#93c5fd", marginTop: 2 }}>
                  {info.cantidadAbiertas} abiertos
                </div>
              )}
              <div style={{ fontSize: 10, color: "#64748b" }}>{info.totalDia} total</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
        <span>🟩 Día cerrado</span>
        <span>🟦 Día con pedidos abiertos</span>
      </div>
    </div>
  );
}
function Noticias({ noticias }: any) {
  if (!noticias || noticias.length === 0) {
    return <p style={{ color: "#64748b", fontSize: 13, marginBottom: 32 }}>Sin novedades para mostrar.</p>;
  }
  return (
    <div style={{ marginBottom: 32, display: "grid", gap: 8 }}>
      {noticias.map((n: any, i: number) => {
        const bueno = n.tipo === "bueno";
        return (
          <div
            key={i}
            style={{
              background: bueno ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
              borderLeft: `4px solid ${bueno ? "#22c55e" : "#ef4444"}`,
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              display: "flex",
              gap: 12,
              alignItems: "baseline",
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: "#94a3b8", fontSize: 12, whiteSpace: "nowrap" }}>
              {formatFecha(n.fecha)}
            </span>
            <span style={{ flex: 1, minWidth: 220 }}>
              <strong>{n.categoria}:</strong> {n.texto}
              {n.detalle && <span style={{ color: "#94a3b8" }}> — {n.detalle}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TortaEstadoTransportadora({ t, idx }: any) {
  const datos = [
    { nombre: "Entregado", valor: t.entregados, color: "#22c55e" },
    { nombre: "En tránsito", valor: t.enTransito, color: "#3b82f6" },
    { nombre: "Devolución", valor: t.devueltos, color: "#f97316" },
  ].filter((x) => x.valor > 0);
  const total = datos.reduce((s, x) => s + x.valor, 0);
  if (!total) return null;

  let ang = 0;
  const r = 70, cx = 80, cy = 80;
  const paths = datos.map((x) => {
    const porcion = x.valor / total;
    const a0 = ang;
    const a1 = ang + porcion * 2 * Math.PI;
    ang = a1;
    const x0 = cx + r * Math.cos(a0 - Math.PI / 2);
    const y0 = cy + r * Math.sin(a0 - Math.PI / 2);
    const x1 = cx + r * Math.cos(a1 - Math.PI / 2);
    const y1 = cy + r * Math.sin(a1 - Math.PI / 2);
    const largo = porcion > 0.5 ? 1 : 0;
    return {
      d: `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${largo} 1 ${x1} ${y1} Z`,
      color: x.color,
      nombre: x.nombre,
      valor: x.valor,
      pct: Math.round(porcion * 1000) / 10,
    };
  });

  return (
    <div
      style={{
        background: "#1e293b",
        borderRadius: 10,
        padding: 16,
        borderTop: `4px solid ${colorTransportadora(t.transportadora, idx)}`,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{t.transportadora}</div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>{t.enviados} enviados</div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <svg viewBox="0 0 160 160" style={{ width: 140, height: 140, flexShrink: 0 }}>
          {paths.map((p, i) => (
            <path key={i} d={p.d} fill={p.color} stroke="#1e293b" strokeWidth="1" />
          ))}
        </svg>
        <div style={{ fontSize: 12, flex: 1, minWidth: 120 }}>
          {paths.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <span style={{ width: 10, height: 10, background: p.color, borderRadius: 2, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{p.nombre}</span>
              <span style={{ color: "#94a3b8" }}>{p.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
// Normaliza nombres de departamentos para que coincidan entre el GeoJSON y
// los datos de Dropi (quita tildes, unifica variantes de nombre)
function normDepto(s: string) {
  let n = (s || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/\./g, "")
    .trim();
  if (n.includes("SAN ANDRES")) return "SAN ANDRES";
  if (n.includes("BOGOTA")) return "CUNDINAMARCA"; // Dropi manda Bogotá dentro de Cundinamarca
  if (n.startsWith("VALLE")) return "VALLE";
  if (n.includes("NORTE DE SANTANDER")) return "NORTE DE SANTANDER";
  if (n.includes("GUAJIRA")) return "LA GUAJIRA";
  return n;
}

// Calcula el centro aproximado de un departamento, para ubicar su etiqueta
function centroide(f: any, proj: (lon: number, lat: number) => [number, number]): [number, number] | null {
  const g = f.geometry;
  if (!g) return null;
  let anillos: any[] = [];
  if (g.type === "Polygon") anillos = g.coordinates;
  else if (g.type === "MultiPolygon") anillos = g.coordinates.flat();
  if (anillos.length === 0) return null;
  // Usamos el anillo más grande (el cuerpo principal, ignora islas chicas)
  const principal = anillos.reduce((a: any, b: any) => (b.length > a.length ? b : a), anillos[0]);
  let sx = 0, sy = 0;
  for (const pt of principal) {
    sx += pt[0];
    sy += pt[1];
  }
  return proj(sx / principal.length, sy / principal.length);
}

function MapaColombia({ porDepartamento, novedadesPorDepartamento }: any) {
  const [geo, setGeo] = useState<any>(null);
  const [errorGeo, setErrorGeo] = useState<string | null>(null);
  const [hover, setHover] = useState<any>(null);
  const [modo, setModo] = useState<"envios" | "novedades">("envios");

  useEffect(() => {
    fetch("/colombia.geo.json")
      .then((r) => {
        if (!r.ok) throw new Error("No se encontró /colombia.geo.json");
        return r.json();
      })
      .then(setGeo)
      .catch((e) => setErrorGeo(e.message));
  }, []);

  const datosPorDepto = new Map<string, any>();
  for (const d of porDepartamento || []) {
    datosPorDepto.set(normDepto(d.departamento), d);
  }
  const novPorDepto = new Map<string, any>();
  for (const d of novedadesPorDepartamento || []) {
    novPorDepto.set(normDepto(d.departamento), d);
  }
  const esNov = modo === "novedades";
  const maxTotal = esNov
    ? Math.max(1, ...(novedadesPorDepartamento || []).map((d: any) => d.total))
    : Math.max(1, ...(porDepartamento || []).map((d: any) => d.total));
  const colorBase = esNov ? "234, 179, 8" : "59, 130, 246"; // amarillo vs azul

  if (errorGeo) {
    return (
      <p style={{ color: "#f87171", fontSize: 13, marginBottom: 32 }}>
        No se pudo cargar el mapa: {errorGeo}. Verificá que el archivo esté en public/colombia.geo.json
      </p>
    );
  }
  if (!geo) return <p style={{ color: "#64748b", fontSize: 13 }}>Cargando mapa...</p>;

  // Proyección simple: Colombia va aprox de -79 a -66 lon, y de -4.3 a 13.5 lat
  const W = 650, H = 775;
  const lonMin = -79.5, lonMax = -66.5, latMin = -4.5, latMax = 13.8;
  const proj = (lon: number, lat: number): [number, number] => [
    ((lon - lonMin) / (lonMax - lonMin)) * W,
    H - ((lat - latMin) / (latMax - latMin)) * H,
  ];

  function ringToPath(ring: any[]): string {
    return ring
      .map((pt: any, i: number) => {
        const [x, y] = proj(pt[0], pt[1]);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ") + " Z";
  }

  function featureToPath(f: any): string {
    const g = f.geometry;
    if (!g) return "";
    if (g.type === "Polygon") return g.coordinates.map(ringToPath).join(" ");
    if (g.type === "MultiPolygon") return g.coordinates.flat().map(ringToPath).join(" ");
    return "";
  }

  function nombreDeFeature(f: any): string {
    const p = f.properties || {};
    return p.NOMBRE_DPT || p.name || p.NOMBRE || p.dpto || p.DPTO_CNMBR || "";
  }

  return (
    <div style={{ background: "#1e293b", borderRadius: 10, padding: 16, marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span style={{ color: "#94a3b8", fontSize: 13 }}>Mostrar en el mapa:</span>
        <select value={modo} onChange={(e) => setModo(e.target.value as any)} style={selectStyle}>
          <option value="envios">Pedidos enviados</option>
          <option value="novedades">Novedades</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
         <svg viewBox={`0 0 ${W} ${H}`} style={{ width: 900, maxWidth: "100%", height: "auto" }}>
        {geo.features.map((f: any, i: number) => {
          const nombre = nombreDeFeature(f);
          const base = datosPorDepto.get(normDepto(nombre));
          const nov = novPorDepto.get(normDepto(nombre));
          const info = esNov ? nov : base;
          const intensidad = info ? 0.15 + (info.total / maxTotal) * 0.75 : 0;
          return (
            <path
              key={i}
              d={featureToPath(f)}
              fill={info ? `rgba(${colorBase}, ${intensidad})` : "#0f172a"}
              stroke="#475569"
              strokeWidth="0.5"
              style={{ cursor: info ? "pointer" : "default" }}
              onMouseEnter={() => info && setHover({ base, nov })}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
         {geo.features.map((f: any, i: number) => {
          const nombre = nombreDeFeature(f);
          // Bogotá D.C. viene como departamento aparte en el mapa, pero para
          // Dropi está dentro de Cundinamarca -> se pinta, pero no lleva su
          // propia etiqueta (evita ver "CUNDINAMARCA" dos veces)
          const nUp = (nombre || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (nUp.includes("BOGOTA")) return null;
          const info = esNov ? novPorDepto.get(normDepto(nombre)) : datosPorDepto.get(normDepto(nombre));
          if (!info) return null;
          const c = centroide(f, proj);
          if (!c) return null;
          return (
            <g key={`lbl${i}`} style={{ pointerEvents: "none" }}>
              <text
                x={c[0]}
                y={c[1]}
                textAnchor="middle"
                             style={{ fontSize: 13, fill: "#e2e8f0", fontWeight: 600, paintOrder: "stroke" }}
                stroke="#0f172a"
                strokeWidth="2.5"
              >
                {info.departamento}
              </text>
              <text
                x={c[0]}
                           y={c[1] + 14}
                textAnchor="middle"
                style={{ fontSize: 13, fill: "#93c5fd", fontWeight: 700, paintOrder: "stroke" }}
                stroke="#0f172a"
                strokeWidth="2.5"
              >
                {info.total}
              </text>
            </g>
          );
        })}
       </svg>
      <div style={{ flex: 1, minWidth: 220, fontSize: 13 }}>
        {hover ? (
          <div style={{ background: "#0f172a", borderRadius: 8, padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
              {(hover.base || hover.nov)?.departamento}
            </div>
            {hover.base && (
              <>
                <div style={{ marginBottom: 4 }}>📦 Envíos: <strong>{hover.base.total}</strong></div>
                <div style={{ color: "#86efac" }}>✅ Entregado: {hover.base.pctEntregado}%</div>
                <div style={{ color: "#fdba74" }}>🔁 Devolución: {hover.base.pctDevolucion}%</div>
                <div style={{ color: "#fca5a5" }}>🚫 Cancelado: {hover.base.pctCancelado}%</div>
              </>
            )}
            {hover.nov && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #334155" }}>
                <div style={{ color: "#fde047" }}>⚠️ Novedades: <strong>{hover.nov.total}</strong></div>
                <div style={{ color: "#fca5a5" }}>Sin resolver: {hover.nov.sinResolver}</div>
                <div style={{ color: "#86efac" }}>Resueltas: {hover.nov.resueltas}</div>
              </div>
            )}
          </div>
        ) : (
          <p style={{ color: "#64748b" }}>Pasá el mouse sobre un departamento para ver sus datos.</p>
        )}
        <p style={{ color: "#64748b", fontSize: 12, marginTop: 12 }}>
          {esNov
            ? "La intensidad del amarillo indica la cantidad de novedades."
            : "La intensidad del azul indica el volumen de envíos."}{" "}
          Los departamentos sin datos quedan en gris.
        </p>
      </div>
      </div>
    </div>
  );
}
function NovedadesPorDia({ dias }: any) {
  const [diaSel, setDiaSel] = useState<string>("__todos__");

  if (!dias || dias.length === 0) {
    return <p style={{ color: "#64748b", fontSize: 13, marginBottom: 32 }}>Sin novedades registradas.</p>;
  }

  const seleccionado = dias.find((d: any) => d.fecha === diaSel);

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ color: "#94a3b8", fontSize: 13 }}>Ver detalle del día:</span>
        <select value={diaSel} onChange={(e) => setDiaSel(e.target.value)} style={selectStyle}>
          <option value="__todos__">Solo el resumen</option>
          {dias.map((d: any) => (
            <option key={d.fecha} value={d.fecha}>
              {formatFecha(d.fecha)} ({d.cantidad})
            </option>
          ))}
        </select>
      </div>

      {!seleccionado ? (
        <Table
          headers={["Fecha", "Novedades nuevas"]}
          rows={dias.slice(0, 30).map((d: any) => [formatFecha(d.fecha), d.cantidad])}
        />
      ) : (
        <div>
          <div
            style={{
              background: "#334155",
              color: "white",
              fontWeight: 600,
              padding: "10px 14px",
              borderRadius: "8px 8px 0 0",
            }}
          >
            {formatFecha(seleccionado.fecha)} — {seleccionado.cantidad} novedades nuevas
          </div>
          <div style={{ overflowX: "auto", background: "#1e293b", borderRadius: "0 0 10px 10px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={th}>Guía</th>
                  <th style={th}>Cliente</th>
                  <th style={th}>Teléfono</th>
                  <th style={th}>Ciudad</th>
                  <th style={th}>Departamento</th>
                  <th style={th}>Transportadora</th>
                  <th style={th}>Estatus actual</th>
                  <th style={th}>Resuelta</th>
                </tr>
              </thead>
              <tbody>
                {seleccionado.ordenes.map((o: any) => (
                  <tr key={o.id}>
                    <td style={td}>{o.numero_guia || "-"}</td>
                    <td style={td}>{o.nombre_cliente || "-"}</td>
                    <td style={td}>{o.telefono || "-"}</td>
                    <td style={td}>{o.ciudad_destino || "-"}</td>
                    <td style={td}>{o.departamento_destino || "-"}</td>
                    <td style={td}>{o.transportadora || "-"}</td>
                    <td style={td}>{o.estatus_actual || "-"}</td>
                    <td style={td}>
                      {o.fecha_solucion ? (
                        <span style={{ color: "#86efac" }}>{formatFecha(o.fecha_solucion)}</span>
                      ) : (
                        <span style={{ color: "#fca5a5" }}>Sin resolver</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
