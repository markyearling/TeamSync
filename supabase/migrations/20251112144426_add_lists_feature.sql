/*
  # Add Lists Feature

  1. New Tables
    - `lists`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text, required)
      - `color` (text, optional)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `list_items`
      - `id` (uuid, primary key)
      - `list_id` (uuid, references lists)
      - `user_id` (uuid, references auth.users)
      - `item_text` (text, required)
      - `is_checked` (boolean, default false)
      - `sort_order` (integer, default 0)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own lists and items
    - Users can only read/write their own lists
    - Users can only read/write items in their own lists

  3. Indexes
    - Add index on lists.user_id for fast user-specific queries
    - Add index on list_items.list_id for fast item lookups
    - Add index on list_items.sort_order for ordering queries
*/

-- Create lists table
CREATE TABLE IF NOT EXISTS lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create list_items table
CREATE TABLE IF NOT EXISTS list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid REFERENCES lists(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_text text NOT NULL,
  is_checked boolean DEFAULT false NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lists table
CREATE POLICY "Users can view own lists"
  ON lists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own lists"
  ON lists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lists"
  ON lists FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lists"
  ON lists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for list_items table
CREATE POLICY "Users can view own list items"
  ON list_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own list items"
  ON list_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own list items"
  ON list_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own list items"
  ON list_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lists_user_id ON lists(user_id);
CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_list_items_user_id ON list_items(user_id);
CREATE INDEX IF NOT EXISTS idx_list_items_sort_order ON list_items(list_id, sort_order);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to update updated_at
DROP TRIGGER IF EXISTS update_lists_updated_at ON lists;
CREATE TRIGGER update_lists_updated_at
  BEFORE UPDATE ON lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_list_items_updated_at ON list_items;
CREATE TRIGGER update_list_items_updated_at
  BEFORE UPDATE ON list_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
