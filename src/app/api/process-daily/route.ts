import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Convierte "28-07-2026" o "28/07/2026" a "2026-07-28" (o null si está vacío/invalido)
function toISODate(value: any): string | null {
  if (!value) return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function toNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const generalRows: any[] = body.generalRows || [];
    const productRows: any[] = body.productRows || [];

    if (generalRows.length === 0 && productRows.length === 0) {
      return NextResponse.json(
        { error: "No se recibieron filas para procesar." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    let nuevos = 0;
    let cambiaronEstatus = 0;
    let sinCambio = 0;

    if (generalRows.length > 0) {
    // --- 1. Traer el estatus actual guardado para las órdenes que vienen en este lote ---
    const ids = generalRows.map((r) => String(r["ID"])).filter(Boolean);
    const { data: existing, error: fetchError } = await supabase
      .from("order_status_history")
      .select("id, estatus_actual, fecha_estatus_desde")
      .in("id", ids);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const existingMap = new Map(
      (existing || []).map((r) => [r.id, r])
    );

    const upsertRows = generalRows.map((row) => {
      const id = String(row["ID"]);
      const estatusNuevo = String(row["ESTATUS"] || "").trim();
      const fechaReporte = toISODate(row["FECHA DE REPORTE"]);
      const prev = existingMap.get(id);

      let fechaEstatusDesde: string | null;
      if (!prev) {
        nuevos++;
        fechaEstatusDesde = fechaReporte;
      } else if (
        (prev.estatus_actual || "").trim().toUpperCase() !==
        estatusNuevo.toUpperCase()
      ) {
        cambiaronEstatus++;
        fechaEstatusDesde = fechaReporte;
      } else {
        sinCambio++;
        fechaEstatusDesde = prev.fecha_estatus_desde || fechaReporte;
      }

      return {
        id,
        estatus_actual: estatusNuevo,
        fecha_estatus_desde: fechaEstatusDesde,
        fecha_reporte: fechaReporte,
        nombre_cliente: row["NOMBRE CLIENTE"] || null,
        telefono: row["TELÉFONO"] ? String(row["TELÉFONO"]) : null,
        ciudad_destino: row["CIUDAD DESTINO"] || null,
        departamento_destino: row["DEPARTAMENTO DESTINO"] || null,
        numero_guia: row["NÚMERO GUIA"] ? String(row["NÚMERO GUIA"]) : null,
        transportadora: row["TRANSPORTADORA"] || null,
        vendedor: row["VENDEDOR"] || null,
        usuario_generacion_guia: row["USUARIO GENERACION DE GUIA"] || null,
        fecha_generacion_guia: toISODate(row["FECHA GENERACION DE GUIA"]),
        ultimo_movimiento: row["ÚLTIMO MOVIMIENTO"] || null,
        fecha_ultimo_movimiento: toISODate(row["FECHA DE ÚLTIMO MOVIMIENTO"]),
        fecha_novedad: toISODate(row["FECHA DE NOVEDAD"]),
        fecha_solucion: toISODate(row["FECHA DE SOLUCIÓN"]),
        valor_facturado: toNumber(row["VALOR FACTURADO"]),
        valor_compra_productos: toNumber(row["VALOR DE COMPRA EN PRODUCTOS"]),
        precio_flete: toNumber(row["PRECIO FLETE"]),
        costo_devolucion_flete: toNumber(row["COSTO DEVOLUCION FLETE"]),
        total_precios_proveedor: toNumber(row["TOTAL EN PRECIOS DE PROVEEDOR"]),
        comision: toNumber(row["COMISION"]),
        ganancia: toNumber(row["GANANCIA"]),
        updated_at: new Date().toISOString(),
      };
    });

    // Supabase/Postgres no acepta más de ~1000 filas por upsert de forma segura -> lotes de 500
    for (let i = 0; i < upsertRows.length; i += 500) {
      const batch = upsertRows.slice(i, i + 500);
      const { error } = await supabase
        .from("order_status_history")
        .upsert(batch, { onConflict: "id" });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    } // fin if (generalRows.length > 0)

    // --- 2. Productos (si se subió el archivo de productos) ---
    let productosActualizados = 0;
    if (productRows.length > 0) {
      const productUpsert = productRows
        .filter((r) => r["ID"] && r["SKU"])
        .map((row) => ({
          order_id: String(row["ID"]),
          sku: String(row["SKU"]),
          producto: row["PRODUCTO"] || null,
          variacion: row["VARIACION"] || null,
          cantidad: toNumber(row["CANTIDAD"]),
          precio_proveedor: toNumber(row["PRECIO PROVEEDOR"]),
          updated_at: new Date().toISOString(),
        }));

      for (let i = 0; i < productUpsert.length; i += 500) {
        const batch = productUpsert.slice(i, i + 500);
        const { error } = await supabase
          .from("order_products")
          .upsert(batch, { onConflict: "order_id,sku" });
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
      productosActualizados = productUpsert.length;
    }

    return NextResponse.json({
      totalProcesado: generalRows.length,
      nuevos,
      cambiaronEstatus,
      sinCambio,
      productosActualizados,
    });
    // Nota: esta ruta procesa un LOTE (batch) del archivo, no el archivo completo.
    // El cliente (upload/page.tsx) se encarga de dividir el archivo en lotes
    // y de sumar los resultados de cada llamada.
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Error desconocido" },
      { status: 500 }
    );
  }
}
