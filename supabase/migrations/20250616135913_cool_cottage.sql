/*
  # Update friend access levels system

  1. Changes
    - Update friendships table to support 'none', 'viewer', 'administrator' roles
    - Update friend_requests table to support new role options
    - Update check constraints for new role values
    - Set default role to 'none' for new friendships

  2. Security
    - Maintain existing RLS policies
    - Update role validation constraints
*/

-- Update friend_requests table constraint to include 'none' role
ALTER TABLE friend_requests DROP CONSTRAINT IF EXISTS friend_requests_role_check;
ALTER TABLE friend_requests ADD CONSTRAINT friend_requests_role_check 
  CHECK (role IN ('none', 'viewer', 'administrator'));

-- Update friendships table constraint to include 'none' role  
ALTER TABLE friendships DROP CONSTRAINT IF EXISTS friendships_role_check;
ALTER TABLE friendships ADD CONSTRAINT friendships_role_check 
  CHECK (role IN ('none', 'viewer', 'administrator'));

-- Update default role for friend_requests to 'none'
ALTER TABLE friend_requests ALTER COLUMN role SET DEFAULT 'none';

-- Update default role for friendships to 'none'
ALTER TABLE friendships ALTER COLUMN role SET DEFAULT 'none';

-- Update existing friendships with 'viewer' role to 'none' role
UPDATE friendships SET role = 'none' WHERE role = 'viewer';

-- Update existing friend_requests with 'viewer' role to 'none' role  
UPDATE friend_requests SET role = 'none' WHERE role = 'viewer';