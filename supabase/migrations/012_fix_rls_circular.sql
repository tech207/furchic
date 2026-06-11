-- ============================================================
-- 012_fix_rls_circular.sql
-- Fix circular RLS between pet_caregivers_owner_all and pets_select_caregiver.
--
-- The cycle:
--   pet_caregivers_owner_all → EXISTS(pets WHERE user_id = auth.uid())
--   → pets_select_caregiver → EXISTS(pet_caregivers WHERE user_id = auth.uid())
--   → pet_caregivers_owner_all → EXISTS(pets …) → infinite recursion
--
-- Fix: replace pets_select_caregiver with a SECURITY DEFINER function that
-- queries pet_caregivers without triggering its own RLS, breaking the loop.
-- ============================================================

-- ── Helper function (SECURITY DEFINER bypasses pet_caregivers RLS) ────────────

CREATE OR REPLACE FUNCTION auth_user_is_pet_caregiver(p_pet_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pet_caregivers
    WHERE pet_id = p_pet_id
      AND user_id = auth.uid()
      AND accepted_at IS NOT NULL
  );
$$;

-- ── Replace pets_select_caregiver to use the helper ───────────────────────────

DROP POLICY IF EXISTS "pets_select_caregiver" ON pets;

CREATE POLICY "pets_select_caregiver" ON pets
  FOR SELECT USING (auth_user_is_pet_caregiver(id));
