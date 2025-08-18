-- Characters table
create table if not exists public.characters (
  id uuid primary key,
  name text not null,
  avatar text,
  description text not null,
  system_prompt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Updated at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger characters_set_updated_at
before update on public.characters
for each row execute function public.set_updated_at();

-- Enable RLS
alter table public.characters enable row level security;

-- Simple policy: allow full access to anon (adjust per your needs)
create policy if not exists "Allow anon read" on public.characters
for select using (true);

create policy if not exists "Allow anon write" on public.characters
for all using (true) with check (true); 