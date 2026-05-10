/*
  # Add Form Session History

  Stores live form-correction session summaries, such as exercise name,
  duration, total reps, correct reps, incorrect reps, and final feedback.
*/

CREATE TABLE IF NOT EXISTS user_form_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  group_name text NOT NULL,
  exercise_name text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  total_reps integer NOT NULL DEFAULT 0,
  correct_reps integer NOT NULL DEFAULT 0,
  incorrect_reps integer NOT NULL DEFAULT 0,
  feedback text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_form_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own form sessions"
  ON user_form_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own form sessions"
  ON user_form_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own form sessions"
  ON user_form_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own form sessions"
  ON user_form_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_form_sessions_user_started
  ON user_form_sessions(user_id, started_at DESC);
