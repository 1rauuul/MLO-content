-- Historial de entrega y límite de invitaciones por docente.

alter table class_invitations
  add column sent_at timestamptz,
  add column delivery_error text;

alter table class_invitations
  add constraint class_invitations_delivery_check
    check (not (sent_at is not null and delivery_error is not null)),
  add constraint class_invitations_delivery_error_check
    check (delivery_error is null
           or delivery_error in ('not_configured', 'rejected', 'network'));

create index class_invitations_sender_idx
  on class_invitations (created_by, created_at desc);
