-- PHASE 5 FOLLOW-UP: restore `authenticated`'s table-level privileges on the

grant select, insert, update, delete
    on public.admin_messages,
       public.admin_message_recipients,
       public.support_tickets,
       public.support_ticket_notes
    to authenticated;
