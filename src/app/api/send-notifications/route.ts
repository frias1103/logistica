import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabaseAdmin";

const ESTATUS_TERMINALES = ["ENTREGADO", "CANCELADO", "RECHAZADO", "GUIA_ANULADA"];
function esTerminal(estatus: string) {
  const e = (estatus || "").trim().toUpperCase();
  return ESTATUS_TERMINALES.includes(e) || e.includes("DEVOLUCION");
}

async function checkAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return false;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data, error } = await supabase.auth.getUser(token);
  return !error && !!data.user;
}

async function fetchAll(supabase: any, table: string) {
  const pageSize = 1000;
  let from = 0;
  let all: any[] = [];
  while (true) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + pageSize - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function sendWhatsApp(text: string) {
  const phone = process.env.WHATSAPP_PHONE;
  const apikey = process.env.WHATSAPP_APIKEY;
  if (!phone || !apikey) {
    return { skipped: true, reason: "Faltan las variables WHATSAPP_PHONE o WHATSAPP_APIKEY en Vercel." };
  }
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(
    phone
  )}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apikey)}`;
  try {
    const res = await fetch(url);
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function POST(req: NextRequest) {
  const authorized = await checkAuth(req);
  if (!authorized) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();

  let orders: any[];
  try {
    orders = await fetchAll(supabase, "order_status_history");
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error trayendo órdenes" }, { status: 500 });
  }

  // --- Referencia de "hoy" = fecha de reporte más reciente ---
  const fechaReporteMax = orders.reduce((max: string | null, o: any) => {
    if (!o.fecha_reporte) return max;
    if (!max || o.fecha_reporte > max) return o.fecha_reporte;
    return max;
  }, null as string | null);
  const HOY = fechaReporteMax ? new Date(fechaReporteMax + "T00:00:00") : new Date();

  function diasDesde(fecha: string | null) {
    if (!fecha) return null;
    const f = new Date(fecha + "T00:00:00");
    return Math.round((HOY.getTime() - f.getTime()) / (1000 * 60 * 60 * 24));
  }

  // --- Conteo por zona de color (igual que en la pestaña Seguimiento) ---
  let verde = 0;
  let amarillo = 0;
  let naranja = 0;
  let rojo = 0;
  for (const o of orders) {
    if (esTerminal(o.estatus_actual)) continue;
    const dias = diasDesde(o.fecha_estatus_desde);
    if (dias === null || dias <= 2) continue;
    if (dias <= 4) verde++;
    else if (dias <= 9) amarillo++;
    else if (dias <= 20) naranja++;
    else rojo++;
  }

  // --- Días cerrados (todas las órdenes de ese día ya en estatus terminal) ---
  const cohortMap = new Map<string, { total: number; terminal: number }>();
  for (const o of orders) {
    if (!o.fecha_orden) continue;
    if (!cohortMap.has(o.fecha_orden)) cohortMap.set(o.fecha_orden, { total: 0, terminal: 0 });
    const c = cohortMap.get(o.fecha_orden)!;
    c.total++;
    if (esTerminal(o.estatus_actual)) c.terminal++;
  }
  const diasCerrados: string[] = [];
  for (const [fecha, c] of cohortMap.entries()) {
    if (c.total > 0 && c.total === c.terminal) diasCerrados.push(fecha);
  }

  const { data: yaNotificados } = await supabase.from("notified_closed_days").select("fecha_orden");
  const yaNotificadosSet = new Set((yaNotificados || []).map((r: any) => r.fecha_orden));
  const nuevosCerrados = diasCerrados.filter((f) => !yaNotificadosSet.has(f)).sort();

  if (nuevosCerrados.length > 0) {
    const rows = nuevosCerrados.map((f) => ({ fecha_orden: f }));
    await supabase.from("notified_closed_days").upsert(rows, { onConflict: "fecha_orden" });
  }

  // --- Componer y enviar el mensaje ---
  let mensaje = `📦 Seguimiento de logística (${fechaReporteMax || "hoy"}):\n`;
  mensaje += `🟢 Verde (2-4 días): ${verde}\n`;
  mensaje += `🟡 Amarillo (5-9 días): ${amarillo}\n`;
  mensaje += `🟠 Naranja (10-20 días): ${naranja}\n`;
  mensaje += `🔴 Rojo (+20 días): ${rojo}`;
  if (nuevosCerrados.length > 0) {
    mensaje += `\n\n✅ Día(s) recién cerrado(s), ya no necesitan seguimiento:\n`;
    mensaje += nuevosCerrados.map((f) => `- ${f}`).join("\n");
  }

  const resultadoEnvio = await sendWhatsApp(mensaje);

  return NextResponse.json({ verde, amarillo, naranja, rojo, nuevosCerrados, mensaje, resultadoEnvio });
}
