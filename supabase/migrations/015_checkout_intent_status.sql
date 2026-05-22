-- Turn checkout_intents from a passive audit log into an actionable order
-- queue. The admin reviews each WhatsApp cart submission and either
-- approves it (flips the items to sold) or cancels it.
--
-- Idempotent: rerunnable.

ALTER TABLE public.checkout_intents
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS decided_by uuid REFERENCES auth.users(id);

-- Constrain status to the three states. Guarded so a rerun doesn't error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checkout_intents_status_check'
  ) THEN
    ALTER TABLE public.checkout_intents
      ADD CONSTRAINT checkout_intents_status_check
      CHECK (status IN ('pending', 'approved', 'cancelled'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS checkout_intents_status_idx
  ON public.checkout_intents (status, created_at DESC);
