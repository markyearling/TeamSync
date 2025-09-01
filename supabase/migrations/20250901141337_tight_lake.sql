/*
  # Change age to date_of_birth in profiles table

  1. Schema Changes
    - Drop `age` column from `profiles` table
    - Add `date_of_birth` column (date, nullable) to `profiles` table

  2. Notes
    - The `date_of_birth` field is optional to allow flexibility
    - Existing profiles will have null date_of_birth after migration
    - Frontend will calculate age from date_of_birth when needed
*/

-- Drop the existing 'age' column
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS age;

-- Add the new 'date_of_birth' column (nullable)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS date_of_birth date;