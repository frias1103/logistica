import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cargaId: string = body.cargaId;
    if (!cargaId) {
      return NextResponse.json({ error: "Falta cargaId" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("upload_sessions")
      .upsert({ id: 1, carga_id_actual: cargaId, updated_at: new Date().toISOString() });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, cargaId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error inesperado" }, { status: 500 });
  }
}
