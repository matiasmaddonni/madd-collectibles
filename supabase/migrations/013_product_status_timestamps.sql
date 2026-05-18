-- Adds sold_at + reserved_at columns to products so the admin dashboard can
-- compute avg-days-in-stock, sales-over-time, recent-sold, and reserved-by-age
-- without relying on updated_at (which any future edit would clobber).
-- Backfills existing rows from updated_at when their status matches.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sold_at timestamptz,
  ADD COLUMN IF NOT EXISTS reserved_at timestamptz;

UPDATE public.products
  SET sold_at = updated_at
  WHERE status = 'sold' AND sold_at IS NULL;

UPDATE public.products
  SET reserved_at = updated_at
  WHERE status = 'reserved' AND reserved_at IS NULL;

-- Trigger maintains sold_at / reserved_at on every insert + status flip.
CREATE OR REPLACE FUNCTION public.products_status_timestamps() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'sold' AND NEW.sold_at IS NULL THEN
      NEW.sold_at := now();
    END IF;
    IF NEW.status = 'reserved' AND NEW.reserved_at IS NULL THEN
      NEW.reserved_at := now();
    END IF;
  ELSE
    -- UPDATE
    IF NEW.status = 'sold' AND OLD.status IS DISTINCT FROM 'sold' THEN
      NEW.sold_at := COALESCE(NEW.sold_at, now());
    END IF;
    IF OLD.status = 'sold' AND NEW.status IS DISTINCT FROM 'sold' THEN
      NEW.sold_at := NULL;
    END IF;
    IF NEW.status = 'reserved' AND OLD.status IS DISTINCT FROM 'reserved' THEN
      NEW.reserved_at := COALESCE(NEW.reserved_at, now());
    END IF;
    IF OLD.status = 'reserved' AND NEW.status IS DISTINCT FROM 'reserved' THEN
      NEW.reserved_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_status_timestamps ON public.products;
CREATE TRIGGER trg_products_status_timestamps
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.products_status_timestamps();
