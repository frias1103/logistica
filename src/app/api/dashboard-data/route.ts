import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Estatus que quedan fuera del bucket "en tránsito" y también fuera de
// entregado/devolución/cancelado (son "no despachado todavía" o casos borde)
const NO_TRANSITO = ["RECHAZADO", "GUIA_ANULADA", "PENDIENTE CONFIRMACION", "PENDIENTE"];

function bucketFor(estatusRaw: string): "entregado" | "devolucion" | "cancelado" | "en_transito" | "otros" {
  const e = (estatusRaw || "").trim().toUpperCase();
  if (e === "ENTREGADO") return "entregado";
  if (e.includes("DEVOLUCION")) return "devolucion";
  if (e === "CANCELADO") return "cancelado";
  if (NO_TRANSITO.includes(e)) return "otros";
  return "en_transito";
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

// Arma un histograma (distribución en rangos) a partir de una lista de números
function histograma(valores: number[], bins = 12) {
  if (valores.length === 0) return [];
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  if (min === max) {
    return [{ desde: min, hasta: max, cantidad: valores.length }];
  }
  const ancho = (max - min) / bins;
  const conteos = new Array(bins).fill(0);
  for (const v of valores) {
    let idx = Math.floor((v - min) / ancho);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    conteos[idx]++;
  }
  return conteos.map((cantidad, i) => ({
    desde: Math.round(min + i * ancho),
    hasta: Math.round(min + (i + 1) * ancho),
    cantidad,
  }));
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

// Supabase entrega máximo 1000 filas por consulta por defecto (aunque se pida
// "todo" con select("*")). Esta función pagina hasta traer la tabla completa.
async function fetchAll(supabase: any, table: string) {
  const pageSize = 1000;
  let from = 0;
  let all: any[] = [];
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export async function GET(req: NextRequest) {
  const authorized = await checkAuth(req);
  if (!authorized) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();

  let orders: any[];
  let products: any[];
  try {
    orders = await fetchAll(supabase, "order_status_history");
    products = await fetchAll(supabase, "order_products");
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error trayendo datos" }, { status: 500 });
  }

const ordersById = new Map(orders!.map((o) => [o.id, o]));

  // Estatus que consideramos "cerrados": si una orden ya llegó ahí, cuenta
  // para siempre, aunque deje de aparecer en reportes futuros.
  const ESTATUS_TERMINALES = ["ENTREGADO", "CANCELADO", "RECHAZADO", "GUIA_ANULADA"];
  const esTerminal = (estatus: string) => {
    const e = (estatus || "").trim().toUpperCase();
    return ESTATUS_TERMINALES.includes(e) || e.includes("DEVOLUCION");
  };

  // Fecha del reporte más reciente subido (para detectar "huérfanas": órdenes
  // no cerradas que dejaron de aparecer en los reportes nuevos, probablemente
  // porque Dropi las sacó del listado sin ponerles un estatus final)
  const fechaReporteMax = orders!.reduce((max: string | null, o: any) => {
    if (!o.fecha_reporte) return max;
    if (!max || o.fecha_reporte > max) return o.fecha_reporte;
    return max;
  }, null as string | null);

  const esHuerfana = (o: any) => {
    const estatus = (o.estatus_actual || "").trim();
    return !esTerminal(estatus) && o.fecha_reporte !== fechaReporteMax;
  };

  // =========================================================
  // 1. ESTATUS GENERAL + POR CIUDAD
  // =========================================================
  const total = orders!.length;
  let huerfanas = 0;
  const estatusCounts = new Map<string, number>();
  const buckets = { entregado: 0, devolucion: 0, cancelado: 0, en_transito: 0, otros: 0 };
const ciudadMap = new Map<string, { entregado: number; devolucion: number; cancelado: number; en_transito: number; otros: number; total: number }>();
  for (const o of orders!) {
    if (esHuerfana(o)) {
      huerfanas++;
      continue; // no la contamos en ningún estatus: no sabemos su estado real
    }

    const estatus = (o.estatus_actual || "SIN ESTATUS").trim();
    estatusCounts.set(estatus, (estatusCounts.get(estatus) || 0) + 1);

    const b = bucketFor(estatus);
    buckets[b]++;

    const ciudad = o.ciudad_destino || "SIN CIUDAD";
    if (!ciudadMap.has(ciudad)) {
      ciudadMap.set(ciudad, { entregado: 0, devolucion: 0, cancelado: 0, en_transito: 0, otros: 0, total: 0 });
    }
    const c = ciudadMap.get(ciudad)!;
    c[b]++;
    c.total++;
  }

  const totalActivo = total - huerfanas;

  const porEstatus = Array.from(estatusCounts.entries())
    .map(([estatus, count]) => ({ estatus, count, pct: pct(count, totalActivo) }))
    .sort((a, b) => b.count - a.count);

  const bucketsResumen = {
    entregado: { count: buckets.entregado, pct: pct(buckets.entregado, totalActivo) },
    devolucion: { count: buckets.devolucion, pct: pct(buckets.devolucion, totalActivo) },
    cancelado: { count: buckets.cancelado, pct: pct(buckets.cancelado, totalActivo) },
    en_transito: { count: buckets.en_transito, pct: pct(buckets.en_transito, totalActivo) },
    otros: { count: buckets.otros, pct: pct(buckets.otros, totalActivo) },
  };

  const porCiudad = Array.from(ciudadMap.entries())
    .map(([ciudad, c]) => ({ ciudad, ...c }))
    .sort((a, b) => b.total - a.total);

  // =========================================================
  // 2. TRANSPORTADORAS + CRUCE CON CIUDAD
  // =========================================================
const transMap = new Map<string, { enviados: number; entregado: number; devolucion: number; en_transito: number; fletes: number[] }>();
  const transCiudadMap = new Map<
    string,
    { transportadora: string; ciudad: string; entregado: number; devolucion: number; en_transito: number; cancelado: number; total: number }
  >();

  for (const o of orders!) {
    if (!o.numero_guia) continue; // solo lo que realmente se despachó
    const b = bucketFor(o.estatus_actual);
    if (b === "cancelado" || b === "otros") continue; // nunca se envió de verdad

  const t = o.transportadora || "SIN TRANSPORTADORA";
    if (!transMap.has(t)) {
      transMap.set(t, { enviados: 0, entregado: 0, devolucion: 0, en_transito: 0, fletes: [] });
    }
    const tm = transMap.get(t)!;
    tm.enviados++;
    if (b === "entregado") tm.entregado++;
    else if (b === "devolucion") tm.devolucion++;
    else tm.en_transito++;
    if (o.precio_flete !== null && o.precio_flete !== undefined) {
      tm.fletes.push(o.precio_flete);
    }
    if (b === "entregado") tm.entregado++;
    else if (b === "devolucion") tm.devolucion++;
    else tm.en_transito++;

    const ciudad = o.ciudad_destino || "SIN CIUDAD";
    const key = `${t}__${ciudad}`;
    if (!transCiudadMap.has(key)) {
      transCiudadMap.set(key, { transportadora: t, ciudad, entregado: 0, devolucion: 0, en_transito: 0, cancelado: 0, total: 0 });
    }
    const tc = transCiudadMap.get(key)!;
    tc.total++;
    if (b === "entregado") tc.entregado++;
    else if (b === "devolucion") tc.devolucion++;
    else tc.en_transito++;
  }

const transportadoras = Array.from(transMap.entries())
    .map(([transportadora, t]) => ({
      transportadora,
      enviados: t.enviados,
      entregados: t.entregado,
      entregadosPct: pct(t.entregado, t.enviados),
      devueltos: t.devolucion,
      devueltosPct: pct(t.devolucion, t.enviados),
      enTransito: t.en_transito,
      enTransitoPct: pct(t.en_transito, t.enviados),
      fleteProm: t.fletes.length
        ? Math.round(t.fletes.reduce((s, v) => s + v, 0) / t.fletes.length)
        : null,
      fleteMin: t.fletes.length ? Math.round(Math.min(...t.fletes)) : null,
      fleteMax: t.fletes.length ? Math.round(Math.max(...t.fletes)) : null,
      histogramaFlete: histograma(t.fletes),
    }))
    .sort((a, b) => b.enviados - a.enviados);

  const transportadoraCiudad = Array.from(transCiudadMap.values()).sort(
    (a, b) => b.total - a.total
  );

  // Costo de flete de TODA la operación (todas las transportadoras juntas)
  const todosLosFletes = Array.from(transMap.values()).flatMap((t) => t.fletes);
  const fleteGlobal = {
    promedio: todosLosFletes.length
      ? Math.round(todosLosFletes.reduce((s, v) => s + v, 0) / todosLosFletes.length)
      : 0,
    minimo: todosLosFletes.length ? Math.round(Math.min(...todosLosFletes)) : 0,
    maximo: todosLosFletes.length ? Math.round(Math.max(...todosLosFletes)) : 0,
    cantidad: todosLosFletes.length,
    histograma: histograma(todosLosFletes, 15),
  };
 // =========================================================
  // 3. DINERO
  // =========================================================
  function ganancia(o: any, esDevolucion: boolean) {
    const venta = o.valor_compra_productos || 0;
    const flete = o.precio_flete || 0;
    const proveedor = o.total_precios_proveedor || 0;
    const fleteDevolucion = esDevolucion ? o.costo_devolucion_flete || 0 : 0;
    return venta - flete - proveedor - fleteDevolucion;
  }

  // Estatus que indican que la orden está a 1-2 días de entregarse
  const ESTATUS_PROXIMOS_A_ENTREGAR = [
    "EN REPARTO",
    "EN BODEGA DESTINO",
    "INTENTO DE ENTREGA",
    "RECLAME EN OFICINA",
    "EN PUNTO DROOP",
    "EN TERMINAL DESTINO",
    "EN BODEGA TRANSPORTADORA",
    "EN PROCESAMIENTO",
  ];

  const dinero = {
    entregado: { suma: 0, cantidad: 0 },
    en_transito: { suma: 0, cantidad: 0 },
    devolucion: { suma: 0, cantidad: 0 },
    proximo_a_entregar: { suma: 0, cantidad: 0 },
  };

  for (const o of orders!) {
    const b = bucketFor(o.estatus_actual);
    if (b === "entregado") {
      dinero.entregado.suma += ganancia(o, false);
      dinero.entregado.cantidad++;
    } else if (b === "en_transito") {
      dinero.en_transito.suma += ganancia(o, false);
      dinero.en_transito.cantidad++;
    } else if (b === "devolucion") {
      dinero.devolucion.suma += ganancia(o, true);
      dinero.devolucion.cantidad++;
    }

    const estatusUpper = (o.estatus_actual || "").trim().toUpperCase();
    if (ESTATUS_PROXIMOS_A_ENTREGAR.includes(estatusUpper)) {
      dinero.proximo_a_entregar.suma += ganancia(o, false);
      dinero.proximo_a_entregar.cantidad++;
    }
  }
  dinero.entregado.suma = Math.round(dinero.entregado.suma);
  dinero.en_transito.suma = Math.round(dinero.en_transito.suma);
  dinero.devolucion.suma = Math.round(dinero.devolucion.suma);
  dinero.proximo_a_entregar.suma = Math.round(dinero.proximo_a_entregar.suma);

  // =========================================================
  // 4. PRODUCTO + CRUCE CON CIUDAD
  // =========================================================
  const productoMap = new Map<
    string,
    { entregado: number; devolucion: number; cancelado: number; en_transito: number }
  >();
  const productoCiudadMap = new Map<
    string,
    { producto: string; ciudad: string; entregado: number; devolucion: number; cancelado: number; en_transito: number }
  >();

  for (const p of products!) {
    const orden = ordersById.get(p.order_id);
    if (!orden) continue;
    const b = bucketFor(orden.estatus_actual);
    const cantidad = p.cantidad || 1;
    const nombre = p.producto || "SIN NOMBRE";

    if (!productoMap.has(nombre)) {
      productoMap.set(nombre, { entregado: 0, devolucion: 0, cancelado: 0, en_transito: 0 });
    }
    const pm = productoMap.get(nombre)!;
    if (b === "entregado") pm.entregado += cantidad;
    else if (b === "devolucion") pm.devolucion += cantidad;
    else if (b === "cancelado") pm.cancelado += cantidad;
    else if (b === "en_transito") pm.en_transito += cantidad;

    const ciudad = orden.ciudad_destino || "SIN CIUDAD";
    const key = `${nombre}__${ciudad}`;
    if (!productoCiudadMap.has(key)) {
      productoCiudadMap.set(key, { producto: nombre, ciudad, entregado: 0, devolucion: 0, cancelado: 0, en_transito: 0 });
    }
    const pc = productoCiudadMap.get(key)!;
    if (b === "entregado") pc.entregado += cantidad;
    else if (b === "devolucion") pc.devolucion += cantidad;
    else if (b === "cancelado") pc.cancelado += cantidad;
    else if (b === "en_transito") pc.en_transito += cantidad;
  }

  const productoResumen = Array.from(productoMap.entries())
    .map(([producto, p]) => ({
      producto,
      ...p,
      total: p.entregado + p.devolucion + p.cancelado + p.en_transito,
    }))
    .sort((a, b) => b.total - a.total);

  const productoCiudad = Array.from(productoCiudadMap.values());

  // Producto × ciudad × transportadora (para el desplegable de transportadoras
  // dentro de cada ciudad en la pestaña de Producto)
  const productoCiudadTransMap = new Map<
    string,
    { producto: string; ciudad: string; transportadora: string; entregado: number; devolucion: number; cancelado: number; en_transito: number }
  >();
  for (const p of products) {
    const orden = ordersById.get(p.order_id);
    if (!orden) continue;
    const b = bucketFor(orden.estatus_actual);
    const cantidad = p.cantidad || 1;
    const nombre = p.producto || "SIN NOMBRE";
    const ciudad = orden.ciudad_destino || "SIN CIUDAD";
    const transportadora = orden.transportadora || "SIN TRANSPORTADORA";
    const key = `${nombre}__${ciudad}__${transportadora}`;
    if (!productoCiudadTransMap.has(key)) {
      productoCiudadTransMap.set(key, { producto: nombre, ciudad, transportadora, entregado: 0, devolucion: 0, cancelado: 0, en_transito: 0 });
    }
    const pct2 = productoCiudadTransMap.get(key)!;
    if (b === "entregado") pct2.entregado += cantidad;
    else if (b === "devolucion") pct2.devolucion += cantidad;
    else if (b === "cancelado") pct2.cancelado += cantidad;
    else if (b === "en_transito") pct2.en_transito += cantidad;
  }
  const productoCiudadTransportadora = Array.from(productoCiudadTransMap.values());

 // =========================================================
  // 5. PRODUCTIVIDAD DEL EQUIPO
  // =========================================================
  const guiasPorUsuarioDia = new Map<string, number>();
  for (const o of orders!) {
    if (!o.usuario_generacion_guia || !o.fecha_generacion_guia) continue;
    const key = `${o.usuario_generacion_guia}__${o.fecha_generacion_guia}`;
    guiasPorUsuarioDia.set(key, (guiasPorUsuarioDia.get(key) || 0) + 1);
  }
  const guiasPorUsuarioPorDia = Array.from(guiasPorUsuarioDia.entries())
    .map(([key, cantidad]) => {
      const [usuario, fecha] = key.split("__");
      return { usuario, fecha, cantidad };
    })
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  const vendedorMap = new Map<string, number>();
  for (const o of orders!) {
    const v = o.vendedor && o.vendedor.trim() ? o.vendedor.trim() : "SIN VENDEDOR ASIGNADO";
    vendedorMap.set(v, (vendedorMap.get(v) || 0) + 1);
  }
  const confirmacionesPorVendedor = Array.from(vendedorMap.entries())
    .map(([vendedor, cantidad]) => ({ vendedor, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);

  // Fecha del reporte más reciente en el historial (mismo criterio que Seguimiento)
  const fechaReporteMaxProductividad = orders!.reduce((max: string | null, o: any) => {
    if (!o.fecha_reporte) return max;
    if (!max || o.fecha_reporte > max) return o.fecha_reporte;
    return max;
  }, null as string | null);

  // Confirmadas HOY (el vendedor de la orden cambió/se asignó en el último reporte)
  const vendedorHoyMap = new Map<string, number>();
  for (const o of orders!) {
    if (!o.fecha_vendedor_desde || o.fecha_vendedor_desde !== fechaReporteMaxProductividad) continue;
    const v = o.vendedor && o.vendedor.trim() ? o.vendedor.trim() : "SIN VENDEDOR ASIGNADO";
    vendedorHoyMap.set(v, (vendedorHoyMap.get(v) || 0) + 1);
  }
  const confirmacionesPorVendedorHoy = Array.from(vendedorHoyMap.entries())
    .map(([vendedor, cantidad]) => ({ vendedor, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);

// Confirmadas por día (histórico, día por día, desde que existe fecha_vendedor_desde)
  const vendedorPorDiaMap = new Map<string, number>();
  for (const o of orders!) {
    if (!o.fecha_vendedor_desde) continue;
    const v = o.vendedor && o.vendedor.trim() ? o.vendedor.trim() : "SIN VENDEDOR ASIGNADO";
    const key = `${v}__${o.fecha_vendedor_desde}`;
    vendedorPorDiaMap.set(key, (vendedorPorDiaMap.get(key) || 0) + 1);
  }
  const confirmacionesPorVendedorPorDia = Array.from(vendedorPorDiaMap.entries())
    .map(([key, cantidad]) => {
      const [vendedor, fecha] = key.split("__");
      return { vendedor, fecha, cantidad };
    })
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  // =========================================================
  // 6. SEGUIMIENTO POR TAGS (ANTICIPO PAGADO, ENVIO A OFICINA)
  // =========================================================
  const TAGS_A_SEGUIR = ["ANTICIPO PAGADO", "ENVIO A OFICINA"];
  const NO_ENVIADO_TAGS = ["CANCELADO", "RECHAZADO", "PENDIENTE CONFIRMACION", "GUIA_ANULADA"];

  const tagsResumen = TAGS_A_SEGUIR.map((tagBuscado) => {
    const ordenesConTag = orders.filter((o) => {
      const t = (o.tags || "").toUpperCase();
      if (!t.includes(tagBuscado.toUpperCase())) return false;
      const estatus = (o.estatus_actual || "").trim().toUpperCase();
      return !NO_ENVIADO_TAGS.includes(estatus);
    });

    const cantidad = ordenesConTag.length;

    const ciudadTagMap = new Map<
      string,
      { entregado: number; devolucion: number; en_transito: number; total: number }
    >();
    for (const o of ordenesConTag) {
      const b = bucketFor(o.estatus_actual);
      const ciudad = o.ciudad_destino || "SIN CIUDAD";
      if (!ciudadTagMap.has(ciudad)) {
        ciudadTagMap.set(ciudad, { entregado: 0, devolucion: 0, en_transito: 0, total: 0 });
      }
      const c = ciudadTagMap.get(ciudad)!;
      c.total++;
      if (b === "entregado") c.entregado++;
      else if (b === "devolucion") c.devolucion++;
      else c.en_transito++;
    }

    const porCiudad = Array.from(ciudadTagMap.entries())
      .map(([ciudad, c]) => ({
        ciudad,
        total: c.total,
        entregado: c.entregado,
        entregadoPct: pct(c.entregado, c.total),
        devolucion: c.devolucion,
        devolucionPct: pct(c.devolucion, c.total),
        enTransito: c.en_transito,
        enTransitoPct: pct(c.en_transito, c.total),
      }))
      .sort((a, b) => b.total - a.total);

    return {
      tag: tagBuscado,
      cantidad,
      pctDelTotal: pct(cantidad, total),
      porCiudad,
    };
  });

// =========================================================
  // 7. SEGUIMIENTO DE ÓRDENES SIN MOVIMIENTO (usa fecha_estatus_desde)
  // =========================================================
  // A diferencia del filtro general de arriba, aquí SÍ incluimos
  // PENDIENTE CONFIRMACION, PENDIENTE y GUIA_GENERADA, porque ahora tenemos
  // la fecha real de cambio de estatus (no dependemos de que la
  // transportadora reporte un evento).
  // (ESTATUS_TERMINALES, esTerminal y fechaReporteMax ya se calcularon arriba,
  // en la Sección 1, para detectar huérfanas)
  const HOY = fechaReporteMax ? new Date(fechaReporteMax + "T00:00:00") : new Date();

  function diasDesde(fecha: string | null) {
    if (!fecha) return null;
    const f = new Date(fecha + "T00:00:00");
    return Math.round((HOY.getTime() - f.getTime()) / (1000 * 60 * 60 * 24));
  }

const seguimientoGruposMap = new Map<string, any[]>();
  const totalPorEstatusMap = new Map<string, number>();

  for (const o of orders!) {
    if (esHuerfana(o)) continue; // no la contamos: no sabemos su estado real

    const estatus = (o.estatus_actual || "SIN ESTATUS").trim();
    totalPorEstatusMap.set(estatus, (totalPorEstatusMap.get(estatus) || 0) + 1);
    if (esTerminal(estatus)) continue;

    const dias = diasDesde(o.fecha_estatus_desde);
    if (dias === null || dias <= 2) continue;

 if (!seguimientoGruposMap.has(estatus)) seguimientoGruposMap.set(estatus, []);
seguimientoGruposMap.get(estatus)!.push({
      id: o.id,
      nombre_cliente: o.nombre_cliente,
      telefono: o.telefono,
      ciudad_destino: o.ciudad_destino,
      numero_guia: o.numero_guia,
      dias,
      fecha_estatus_desde: o.fecha_estatus_desde,
      fecha_reportado: o.fecha_reportado || null,
      nota: o.nota || null,
    });
  }

  const resumenPorEstatus = Array.from(seguimientoGruposMap.entries())
    
    .map(([estatus, ords]) => ({
      estatus,
      sinMovimiento: ords.length,
      totalEnEstatus: totalPorEstatusMap.get(estatus) || 0,
      pct: pct(ords.length, totalPorEstatusMap.get(estatus) || 0),
    }))
    .sort((a, b) => b.sinMovimiento - a.sinMovimiento);

  const grupos = Array.from(seguimientoGruposMap.entries())
    .map(([estatus, ords]) => {
      const sorted = [...ords].sort((a, b) => b.dias - a.dias);
      const fechas = ords.map((o) => o.fecha_estatus_desde).filter(Boolean).sort();
      return {
        estatus,
        cantidad: sorted.length,
        desde: fechas[0] || null,
        hasta: fechas[fechas.length - 1] || null,
        ordenes: sorted,
      };
    })
    .sort((a, b) => {
      const maxA = a.ordenes[0]?.dias || 0;
      const maxB = b.ordenes[0]?.dias || 0;
      return maxB - maxA;
    });

  const seguimiento = {
    fechaReporte: fechaReporteMax,
    totalSinMovimiento: resumenPorEstatus.reduce((s, r) => s + r.sinMovimiento, 0),
    resumenPorEstatus,
    grupos,
  };

return NextResponse.json({
    total,
    totalActivo,
    huerfanas,
    porEstatus,
    buckets: bucketsResumen,
    porCiudad,
    transportadoras,
    transportadoraCiudad,
    fleteGlobal,
    dinero,
    productoResumen,
    productoCiudad,
    productoCiudadTransportadora,
    guiasPorUsuarioPorDia,
    confirmacionesPorVendedor,
    confirmacionesPorVendedorHoy,
    confirmacionesPorVendedorPorDia,
    fechaReporteMaxProductividad,
    tagsResumen,
    seguimiento,
  });
}
