alter table subscriptions add column if not exists stripe_customer_id text;
alter table subscriptions add column if not exists stripe_subscription_id text;
alter table subscriptions add column if not exists amount_cents integer not null default 0;
