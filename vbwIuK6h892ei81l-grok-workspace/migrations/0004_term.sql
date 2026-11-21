alter table subscriptions add column if not exists term text not null default 'month';
