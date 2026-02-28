-- Migration 006: portfolio_goals table
-- Weekly goals/notes per portfolio (or all portfolios) per week
-- Mirrors campaign_notes pattern: no FK on tenant_id, RLS via auth.uid()

CREATE TABLE public.portfolio_goals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  week_id      text NOT NULL,
  portfolio_id text NOT NULL,  -- "__ALL__" when All Portfolios is selected
  note         text NOT NULL DEFAULT '',
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (tenant_id, week_id, portfolio_id)
);

ALTER TABLE public.portfolio_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own portfolio goals"
  ON public.portfolio_goals
  FOR ALL
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());
