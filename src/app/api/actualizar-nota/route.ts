import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabaseAdmin";

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

export async function POST(req: NextRequest) {
  try {
    const ok = await checkAuth(req);
    if (!ok) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const body = await req.json();
    const id = String(body.id || "");
    const nota: string | null = body.nota ?? null;

    if (!id) {
      return NextResponse.json({ error: "Falta el id de la orden." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("order_status_history")
      .update({ nota })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id, nota });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error inesperado." }, { status: 500 });
  }
}
