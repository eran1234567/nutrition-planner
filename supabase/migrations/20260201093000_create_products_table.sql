-- Create products table for verified nutrition data
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  brand text,
  calories numeric,
  carbs numeric,
  fiber numeric,
  sodium numeric,
  serving_grams numeric,
  created_at timestamp with time zone default now()
);

create index if not exists products_product_name_idx on public.products (product_name);
create index if not exists products_brand_idx on public.products (brand);
