create or replace function public.restore_task_with_reason(
  p_task_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task tasks%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  select * into v_task from public.tasks where id = p_task_id;
  if not found then
    raise exception 'Task not found';
  end if;

  update public.tasks
  set deleted_at = null,
      deleted_by = null
  where id = p_task_id
    and deleted_at is not null;

  perform public.write_audit_log(
    'TASK_RESTORED',
    'tasks',
    p_task_id,
    jsonb_build_object(
      'reason', coalesce(nullif(trim(p_reason), ''), 'No reason provided'),
      'restored_title', v_task.title,
      'restored_reporting_area', v_task.reporting_area
    )
  );
end;
$$;
