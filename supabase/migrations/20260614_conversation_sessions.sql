-- Create conversation_sessions table for state management
CREATE TABLE IF NOT EXISTS conversation_sessions (
  user_phone TEXT PRIMARY KEY,
  user_role TEXT NOT NULL,
  current_state TEXT DEFAULT 'idle',
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create pending_actions table for confirmation flow
CREATE TABLE IF NOT EXISTS pending_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_phone TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_data JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending_confirmation',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_actions_user_phone ON pending_actions(user_phone);
CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON pending_actions(status);
