update subscriptions set plan = 'basic' where plan in ('simple', 'desk');
update subscriptions set plan = 'premium' where plan = 'mid';
update subscriptions set plan = 'plus' where plan = 'full';
alter table subscriptions alter column plan set default 'basic';
