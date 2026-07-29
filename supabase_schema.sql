-- =========================================================
-- Ejecuta TODO este archivo en Supabase: Project > SQL Editor > New query > pegar > Run
-- =========================================================

-- Tabla principal: una fila por ORDEN (viene del "archivo general")
create table if not exists order_status_history (
  id text primary key,
  estatus_actual text,
  fecha_estatus_desde date,        -- desde cuándo tiene este estatus (calculado, no viene del Excel)
  fecha_reporte date,               -- fecha del último reporte donde se vio esta orden
  nombre_cliente text,
  telefono text,
  ciudad_destino text,
  departamento_destino text,
  numero_guia text,
  transportadora text,
  vendedor text,
  usuario_generacion_guia text,
  fecha_generacion_guia date,
  ultimo_movimiento text,
  fecha_ultimo_movimiento date,
  fecha_novedad date,
  fecha_solucion date,
  valor_facturado numeric,
  valor_compra_productos numeric,
  precio_flete numeric,
  costo_devolucion_flete numeric,
  total_precios_proveedor numeric,
  comision numeric,
  ganancia numeric,
  updated_at timestamptz default now()
);

-- Tabla de productos por orden (viene del "archivo de productos"), puede haber varias filas por orden
create table if not exists order_products (
  order_id text not null,
  sku text not null,
  producto text,
  variacion text,
  cantidad numeric,
  precio_proveedor numeric,
  updated_at timestamptz default now(),
  primary key (order_id, sku)
);

-- Seguridad: solo usuarios logueados pueden leer/escribir
alter table order_status_history enable row level security;
alter table order_products enable row level security;

create policy "authenticated read order_status_history"
  on order_status_history for select
  using (auth.role() = 'authenticated');

create policy "authenticated write order_status_history"
  on order_status_history for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated read order_products"
  on order_products for select
  using (auth.role() = 'authenticated');

create policy "authenticated write order_products"
  on order_products for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
