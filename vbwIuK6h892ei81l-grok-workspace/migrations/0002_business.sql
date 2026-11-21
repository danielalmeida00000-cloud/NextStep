create table if not exists profiles (
  user_id text primary key,
  role text not null default 'member',
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  user_id text primary key,
  status text not null default 'none',
  plan text not null default 'simple',
  updated_at timestamptz not null default now()
);
