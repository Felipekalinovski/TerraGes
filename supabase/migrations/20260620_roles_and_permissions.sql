-- Add gestor role and permission constraints

-- Add check constraint to profiles.role
ALTER TABLE profiles ADD CONSTRAINT valid_role CHECK (role IN ('admin', 'gestor', 'operator'));

-- Update any 'manager' role to 'gestor'
UPDATE profiles SET role = 'gestor' WHERE role = 'manager';

-- Ensure email is required for admin/gestor
ALTER TABLE profiles ADD CONSTRAINT admin_gestor_needs_email CHECK (
  role NOT IN ('admin', 'gestor') OR (email IS NOT NULL AND email != '')
);

-- Ensure phone is required for all roles
ALTER TABLE profiles ADD CONSTRAINT profile_needs_phone CHECK (
  phone IS NOT NULL AND phone != ''
);
