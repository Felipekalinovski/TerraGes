-- Ensure profiles table has 'name' column (it should, but cache might be stale)
ALTER TABLE IF EXISTS profiles 
ADD COLUMN IF NOT EXISTS name TEXT;

-- Trigger schema cache refresh by making a minor DDL change (adding/dropping an empty column)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS _schema_refresh BOOLEAN;
ALTER TABLE profiles DROP COLUMN IF EXISTS _schema_refresh;

-- Re-verify indexes or triggers if needed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'updated_at') THEN
        ALTER TABLE profiles ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END
$$;
