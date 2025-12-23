/*
  # Add List Sharing with Administrator Friends

  1. New Tables
    - `list_shares`
      - `id` (uuid, primary key)
      - `list_id` (uuid, references lists)
      - `owner_id` (uuid, references auth.users)
      - `shared_with_user_id` (uuid, references auth.users)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - Unique constraint on (list_id, shared_with_user_id)

  2. Security
    - Enable RLS on list_shares table
    - Add policies for users to view shares they own or are part of
    - Add policies for owners to manage shares
    - Update lists table policies to allow shared access
    - Update list_items table policies to allow shared access

  3. Helper Function
    - Create function to get administrator friends for sharing
    
  4. Indexes
    - Add indexes for performance on list_id, owner_id, and shared_with_user_id
*/

-- Create list_shares table
CREATE TABLE IF NOT EXISTS list_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(list_id, shared_with_user_id),
  CHECK(owner_id != shared_with_user_id)
);

-- Enable RLS
ALTER TABLE list_shares ENABLE ROW LEVEL SECURITY;

-- List shares policies
CREATE POLICY "Users can view shares they own or are part of"
  ON list_shares
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = shared_with_user_id);

CREATE POLICY "List owners can create shares"
  ON list_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id AND
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_id AND lists.user_id = auth.uid()
    )
  );

CREATE POLICY "List owners can delete shares"
  ON list_shares
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = owner_id AND
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_id AND lists.user_id = auth.uid()
    )
  );

-- Update lists table policies to allow shared access
DROP POLICY IF EXISTS "Users can view own lists" ON lists;
DROP POLICY IF EXISTS "Users can create own lists" ON lists;
DROP POLICY IF EXISTS "Users can update own lists" ON lists;
DROP POLICY IF EXISTS "Users can delete own lists" ON lists;

CREATE POLICY "Users can view own and shared lists"
  ON lists
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM list_shares
      WHERE list_shares.list_id = lists.id
      AND list_shares.shared_with_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own lists"
  ON lists
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lists"
  ON lists
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lists"
  ON lists
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update list_items table policies to allow shared access
DROP POLICY IF EXISTS "Users can view own list items" ON list_items;
DROP POLICY IF EXISTS "Users can create own list items" ON list_items;
DROP POLICY IF EXISTS "Users can update own list items" ON list_items;
DROP POLICY IF EXISTS "Users can delete own list items" ON list_items;

CREATE POLICY "Users can view own and shared list items"
  ON list_items
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM list_shares
      WHERE list_shares.list_id = list_items.list_id
      AND list_shares.shared_with_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert items in own and shared lists"
  ON list_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND (
      EXISTS (SELECT 1 FROM lists WHERE lists.id = list_id AND lists.user_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM list_shares WHERE list_shares.list_id = list_items.list_id AND list_shares.shared_with_user_id = auth.uid())
    )
  );

CREATE POLICY "Users can update items in own and shared lists"
  ON list_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM lists WHERE lists.id = list_id AND lists.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM list_shares WHERE list_shares.list_id = list_items.list_id AND list_shares.shared_with_user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM lists WHERE lists.id = list_id AND lists.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM list_shares WHERE list_shares.list_id = list_items.list_id AND list_shares.shared_with_user_id = auth.uid())
  );

CREATE POLICY "Users can delete items in own and shared lists"
  ON list_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM lists WHERE lists.id = list_id AND lists.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM list_shares WHERE list_shares.list_id = list_items.list_id AND list_shares.shared_with_user_id = auth.uid())
  );

-- Create function to get administrator friends
CREATE OR REPLACE FUNCTION get_administrator_friends()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  avatar_url text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email,
    up.full_name,
    up.avatar_url
  FROM friendships f
  JOIN auth.users u ON u.id = f.friend_id
  LEFT JOIN user_profiles up ON up.user_id = u.id
  WHERE f.user_id = auth.uid()
    AND f.role = 'administrator';
END;
$$;

-- Add updated_at trigger
CREATE TRIGGER update_list_shares_updated_at
  BEFORE UPDATE ON list_shares
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_list_shares_list ON list_shares(list_id);
CREATE INDEX IF NOT EXISTS idx_list_shares_owner ON list_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_list_shares_shared_with ON list_shares(shared_with_user_id);