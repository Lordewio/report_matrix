-- Soft delete support for tasks
alter table public.tasks
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users(id);

-- Audit log table
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

create policy "select_audit_admin_only"
on public.audit_logs
for select
using (public.is_admin());

-- Shared helper to write audit records
create or replace function public.write_audit_log(
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- Audit task lifecycle
create or replace function public.audit_tasks_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    perform public.write_audit_log('TASK_CREATED', 'tasks', NEW.id, jsonb_build_object(
      'title', NEW.title,
      'reporting_area', NEW.reporting_area
    ));
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    if OLD.deleted_at is null and NEW.deleted_at is not null then
      perform public.write_audit_log('TASK_ARCHIVED', 'tasks', NEW.id, jsonb_build_object(
        'deleted_at', NEW.deleted_at,
        'deleted_by', NEW.deleted_by
      ));
    else
      perform public.write_audit_log('TASK_UPDATED', 'tasks', NEW.id, jsonb_build_object(
        'title', NEW.title,
        'reporting_area', NEW.reporting_area
      ));
    end if;
    return NEW;
  end if;

  if TG_OP = 'DELETE' then
    perform public.write_audit_log('TASK_DELETED', 'tasks', OLD.id, jsonb_build_object(
      'title', OLD.title,
      'reporting_area', OLD.reporting_area
    ));
    return OLD;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_audit_tasks_changes on public.tasks;
create trigger trg_audit_tasks_changes
after insert or update or delete on public.tasks
for each row execute procedure public.audit_tasks_changes();

-- Audit attachment lifecycle
create or replace function public.audit_attachments_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    perform public.write_audit_log('ATTACHMENT_ADDED', 'attachments', NEW.id, jsonb_build_object(
      'task_id', NEW.task_id,
      'file_url', NEW.file_url
    ));
    return NEW;
  end if;

  if TG_OP = 'DELETE' then
    perform public.write_audit_log('ATTACHMENT_REMOVED', 'attachments', OLD.id, jsonb_build_object(
      'task_id', OLD.task_id,
      'file_url', OLD.file_url
    ));
    return OLD;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_audit_attachments_changes on public.attachments;
create trigger trg_audit_attachments_changes
after insert or delete on public.attachments
for each row execute procedure public.audit_attachments_changes();

-- Audit role changes
create or replace function public.audit_user_role_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.role is distinct from OLD.role then
    perform public.write_audit_log('USER_ROLE_CHANGED', 'users', NEW.id, jsonb_build_object(
      'old_role', OLD.role,
      'new_role', NEW.role
    ));
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_audit_user_role_changes on public.users;
create trigger trg_audit_user_role_changes
after update on public.users
for each row execute procedure public.audit_user_role_changes();
