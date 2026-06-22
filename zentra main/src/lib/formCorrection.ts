import type { User } from "@supabase/supabase-js";
import { Activity, BicepsFlexed, Dumbbell, Footprints, Shirt } from "lucide-react";
import { supabase, hasSupabaseConfig } from "@/integrations/supabase/client";
import {
  loadBicepCurlModel, loadDeadliftModel, loadDumbbellFlyModel,
  loadPlankModel, loadPushupModel, loadSquatModel,
} from "@/lib/api";
import type { FormSessionSummary } from "@/lib/types";

export const muscleGroups = [
  { name: "Biceps", exercises: 4, icon: BicepsFlexed },
  { name: "Triceps", exercises: 4, icon: Dumbbell },
  { name: "Chest", exercises: 5, icon: Shirt },
  { name: "Back", exercises: 5, icon: Activity },
  { name: "Core", exercises: 1, icon: Activity },
  { name: "Shoulders", exercises: 5, icon: Dumbbell },
  { name: "Legs", exercises: 5, icon: Footprints },
] as const;

export const exercisesByGroup: Record<string, string[]> = {
  Chest: ["Bench Press", "Push-ups", "Dumbbell Flyes", "Cable Crossover", "Incline Press"],
  Back: ["Pull-ups", "Bent Over Rows", "Lat Pulldown", "Deadlift", "Cable Rows"],
  Core: ["Plank"],
  Shoulders: ["Overhead Press", "Lateral Raises", "Front Raises", "Arnold Press", "Shrugs"],
  Legs: ["Squats", "Lunges", "Leg Press", "Leg Curls", "Calf Raises"],
  Triceps: ["Tricep Dips", "Skull Crushers", "Overhead Extension", "Cable Pushdown"],
  Biceps: ["Bicep Curl", "Hammer Curl", "Preacher Curl", "Concentration Curl"],
};

export type LiveExerciseSlug = "bicep-curl" | "squats" | "deadlifts" | "planks" | "pushups" | "dumbbell-fly";

export type ModelConfig = {
  slug: LiveExerciseSlug;
  label: string;
  load: () => Promise<unknown>;
};

export function getModelConfig(group: string, exercise: string): ModelConfig | null {
  if (group === "Biceps" && exercise === "Bicep Curl") return { slug: "bicep-curl", label: "bicep curl", load: loadBicepCurlModel };
  if (group === "Chest" && exercise === "Push-ups") return { slug: "pushups", label: "push-up", load: loadPushupModel };
  if (group === "Chest" && exercise === "Dumbbell Flyes") return { slug: "dumbbell-fly", label: "dumbbell fly", load: loadDumbbellFlyModel };
  if (group === "Back" && exercise === "Deadlift") return { slug: "deadlifts", label: "deadlift", load: loadDeadliftModel };
  if (group === "Core" && exercise === "Plank") return { slug: "planks", label: "plank", load: loadPlankModel };
  if (group === "Legs" && exercise === "Squats") return { slug: "squats", label: "squat", load: loadSquatModel };
  return null;
}

export type PoseLandmark = {
  name: string;
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

const bicepLandmarkNames = ["right_hip", "left_hip", "right_shoulder", "left_shoulder", "right_elbow", "left_elbow", "right_wrist", "left_wrist"] as const;
const squatLandmarkNames = ["right_hip", "left_hip", "right_knee", "left_knee", "right_ankle", "left_ankle", "right_shoulder", "left_shoulder"] as const;
const deadliftLandmarkNames = ["left_shoulder", "left_elbow", "left_wrist", "left_hip", "left_knee", "left_ankle", "left_heel", "left_foot", "right_shoulder", "right_elbow", "right_wrist", "right_hip", "right_knee", "right_ankle", "right_heel", "right_foot"] as const;
const plankLandmarkNames = ["left_ear", "left_shoulder", "left_elbow", "left_wrist", "left_hip", "left_knee", "left_ankle", "right_ear", "right_shoulder", "right_elbow", "right_wrist", "right_hip", "right_knee", "right_ankle"] as const;
const pushupLandmarkNames = ["nose", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist", "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle"] as const;
const dumbbellFlyLandmarkNames = ["right_shoulder", "left_shoulder", "right_elbow", "left_elbow", "right_wrist", "left_wrist"] as const;

export const skeletonConnections = [
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
  ["left_ankle", "left_heel"],
  ["left_heel", "left_foot"],
  ["right_ankle", "right_heel"],
  ["right_heel", "right_foot"],
] as const;

export const minSkeletonVisibility = 0.05;

export function normalizePoseLandmarks(rawLandmarks: unknown, exerciseSlug: LiveExerciseSlug): PoseLandmark[] {
  if (!Array.isArray(rawLandmarks)) return [];
  const fallbackNames =
    exerciseSlug === "squats" ? squatLandmarkNames
      : exerciseSlug === "deadlifts" ? deadliftLandmarkNames
      : exerciseSlug === "planks" ? plankLandmarkNames
      : exerciseSlug === "pushups" ? pushupLandmarkNames
      : exerciseSlug === "dumbbell-fly" ? dumbbellFlyLandmarkNames
      : bicepLandmarkNames;

  return rawLandmarks
    .map((landmark, index): PoseLandmark | null => {
      if (Array.isArray(landmark)) {
        const [x, y, z, visibility] = landmark;
        return {
          name: fallbackNames[index] ?? `point_${index}`,
          x: Number(x),
          y: Number(y),
          z: Number(z),
          visibility: visibility == null ? 1 : Number(visibility),
        };
      }
      if (landmark && typeof landmark === "object") {
        const point = landmark as Partial<PoseLandmark>;
        return {
          name: String(point.name ?? fallbackNames[index] ?? `point_${index}`),
          x: Number(point.x),
          y: Number(point.y),
          z: point.z == null ? undefined : Number(point.z),
          visibility: point.visibility == null ? 1 : Number(point.visibility),
        };
      }
      return null;
    })
    .filter((landmark): landmark is PoseLandmark => {
      if (!landmark) return false;
      return Number.isFinite(landmark.x) && Number.isFinite(landmark.y);
    });
}

const sessionHistoryLimit = 80;
const sessionHistoryKey = (userId?: string | null) => `zentra:form-session-history:${userId ?? "guest"}`;

export function readSessionHistory(userId?: string | null): FormSessionSummary[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(sessionHistoryKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeSessionHistory(userId: string | null | undefined, rows: FormSessionSummary[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(sessionHistoryKey(userId), JSON.stringify(rows.slice(0, sessionHistoryLimit)));
}

type FormSessionRow = {
  id: string | number;
  user_id?: string;
  group_name?: string;
  group?: string;
  exercise_name?: string;
  exercise?: string;
  started_at: string;
  ended_at: string;
  duration_seconds?: number;
  total_reps?: number;
  correct_reps?: number;
  incorrect_reps?: number;
  feedback?: string | null;
};

export function mapFormSessionRow(row: FormSessionRow): FormSessionSummary {
  return {
    id: String(row.id),
    user_id: row.user_id,
    group: row.group_name ?? row.group ?? "",
    exercise: row.exercise_name ?? row.exercise ?? "",
    started_at: row.started_at,
    ended_at: row.ended_at,
    duration_seconds: Number(row.duration_seconds ?? 0),
    total_reps: Number(row.total_reps ?? 0),
    correct_reps: Number(row.correct_reps ?? 0),
    incorrect_reps: Number(row.incorrect_reps ?? 0),
    feedback: row.feedback ?? undefined,
  };
}

export async function saveSessionSummary(summary: FormSessionSummary, currentUser?: User | null) {
  const userId = summary.user_id ?? currentUser?.id;
  const rows = readSessionHistory(userId);
  writeSessionHistory(userId, [{ ...summary, user_id: userId }, ...rows]);
  if (!userId || !hasSupabaseConfig) return;
  await supabase.from("user_form_sessions").insert({
    user_id: userId,
    group_name: summary.group,
    exercise_name: summary.exercise,
    started_at: summary.started_at,
    ended_at: summary.ended_at,
    duration_seconds: summary.duration_seconds,
    total_reps: summary.total_reps,
    correct_reps: summary.correct_reps,
    incorrect_reps: summary.incorrect_reps,
    feedback: summary.feedback ?? null,
  });
}
