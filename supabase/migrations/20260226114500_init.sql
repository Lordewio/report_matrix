-- Create types and tables
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text unique not null,
  role text not null default 'User',
  created_at timestamptz default now()
);

create type reporting_area as enum (
  'Compliance', 'Enforcement', 'Licensing', 'Litigation and Prosecution', 'Investigations', 'Data Protection', 'Legal Advisory', 'Regulatory Affairs', 'Board Affairs'
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  reporting_area reporting_area not null,
  author_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  file_url text not null,
  uploaded_at timestamptz default now()
);

-- Helper function: check if current authenticated user is an admin in `users` table
create or replace function is_admin() returns boolean language sql stable as $$
  select exists(select 1 from users where id = auth.uid() and role = 'Admin');
$$;

-- RPC to fetch tasks between two dates with author name
create or replace function get_tasks_between(start_date timestamptz, end_date timestamptz)
returns table (
  id uuid,
  title text,
  description text,
  reporting_area reporting_area,
  created_at timestamptz,
  author_name text
) language sql stable as $$
  select t.id, t.title, t.description, t.reporting_area, t.created_at, u.name
  from tasks t
  join users u on u.id = t.author_id
  where t.created_at between start_date and end_date;
$$;

-- Enable RLS and policies
alter table tasks enable row level security;

-- Allow authenticated users to select tasks
create policy "select_tasks_authenticated" on tasks
  for select using (auth.role() = 'authenticated' OR is_admin());

-- Allow inserts by authenticated users and set author_id to auth.uid()
create policy "insert_task_authenticated" on tasks
  for insert with check (auth.role() = 'authenticated');

-- Allow inserts only when author_id matches authenticated user (prevents creating as another user)
create policy "insert_author_matches" on tasks
  for insert with check (author_id = auth.uid());

-- Allow updates only by the author
create policy "update_own_task" on tasks
  for update using (author_id = auth.uid());

-- Admins may update any task
create policy "update_by_admin" on tasks
  for update using (is_admin());

-- Allow deletes only by the author
create policy "delete_own_task" on tasks
  for delete using (author_id = auth.uid());

-- Admins may delete any task
create policy "delete_by_admin" on tasks
  for delete using (is_admin());

-- Attachments: select for authenticated, inserts allowed only when task exists
alter table attachments enable row level security;
create policy "select_attachments_authenticated" on attachments for select using (auth.role() = 'authenticated' OR is_admin());

-- Allow attachments insert only when the task exists and the authenticated user is the author or admin
create policy "insert_attachment_task_owner" on attachments
  for insert with check (
    exists(select 1 from tasks t where t.id = attachments.task_id and (t.author_id = auth.uid() or is_admin()))
  );

-- Reports metadata table (stores generated report references)
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  url text not null,
  content_type text not null,
  generated_at timestamptz default now(),
  generated_by uuid,
  start_date timestamptz,
  end_date timestamptz,
  frequency text
);

alter table reports enable row level security;
create policy "select_reports_authenticated" on reports for select using (auth.role() = 'authenticated' OR is_admin());
create policy "insert_reports_service" on reports for insert with check (is_admin());
