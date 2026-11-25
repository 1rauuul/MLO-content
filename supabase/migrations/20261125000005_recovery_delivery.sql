alter table student_password_resets add column sent_at timestamptz;

update student_password_resets
   set sent_at = created_at
 where sent_at is null;

drop index if exists teacher_tokens_pending_idx;
create unique index teacher_tokens_pending_idx
  on teacher_tokens (teacher_id, purpose)
  where used_at is null
    and revoked_at is null
    and sent_at is not null;
