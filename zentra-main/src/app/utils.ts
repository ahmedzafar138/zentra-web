export function formatHeightValue(value: number, unit: string) {
  if (unit === "cm") return `${value} cm`;
  const totalInches = Math.round(value / 2.54);
  return `${Math.floor(totalInches / 12)} ft ${totalInches % 12} in`;
}

export function formatWeightValue(value: number, unit: string) {
  return unit === "kg" ? `${value} kg` : `${Math.round(value * 2.20462)} lb`;
}

export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export const todayKey = () => new Date().toISOString().split("T")[0];
export const monthKey = (date = new Date()) => date.toISOString().slice(0, 7);

export const calculateBmi = (height?: number | null, weight?: number | null) => {
  if (!height || !weight) return null;
  return Number((weight / (height / 100) ** 2).toFixed(1));
};

export const bmiCategory = (bmi?: number | null) => {
  if (!bmi) return "Not set";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
};
