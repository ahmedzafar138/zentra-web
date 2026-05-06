import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/store/hooks";
import { API_BASE_URL, fetchWithTimeout } from "@/lib/utils";

const FoodAnalysis: React.FC = () => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <h2 className="text-2xl font-bold mb-4">Unauthorized</h2>
        <p className="text-lg">You must be logged in to access this page.</p>
      </div>
    );
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedImage) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedImage);
      const response = await fetch(
        `${API_BASE_URL}/api/v1/food-analysis/analyze-image`,
        {
          method: "POST",
          body: formData,
        }
      );
      if (!response.ok) throw new Error("Failed to analyze image");
      //   console.log(response)
      const data = await response.json();
      //   console.log(data);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleNewUpload = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="max-w-xl mx-auto py-12 px-4 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6 text-gradient-primary">
        Food Image Analysis
      </h1>
      <AnimatePresence>
        {!selectedImage && (
          <motion.label
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            htmlFor="image-upload"
            className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-primary rounded-xl p-8 mb-6 hover:bg-primary/10 transition"
          >
            <svg
              width="64"
              height="64"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="text-primary mb-2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16V4a2 2 0 012-2h12a2 2 0 012 2v12M4 16l4-4a2 2 0 012 0l4 4M4 16h16"
              />
            </svg>
            <span className="text-lg font-medium text-primary">
              Upload an image
            </span>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </motion.label>
        )}
      </AnimatePresence>
      {previewUrl && !result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 w-full flex flex-col items-center"
        >
          <img
            src={previewUrl}
            alt="Preview"
            className="rounded-xl shadow-lg mb-4 max-h-64"
          />
          <Button
            onClick={handleUpload}
            disabled={loading}
            className="bg-gradient-primary text-white font-semibold px-6 py-2 rounded-lg shadow-glow"
          >
            Analyze Image
          </Button>
        </motion.div>
      )}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex flex-col items-center justify-center mt-8"
          >
            <div className="relative w-28 h-28 flex items-center justify-center mb-4">
              <div
                className="absolute inset-0 rounded-full animate-spin"
                style={{
                  background:
                    "conic-gradient(from 180deg at 50% 50%, #6366f1 0%, #06b6d4 50%, #a21caf 100%)",
                }}
              />
            </div>
            <span className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-500 animate-pulse"></span>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="mt-8 w-full bg-gradient-to-br from-primary/10 to-surface/10 rounded-xl shadow-lg p-6"
          >
            <h2 className="text-2xl font-bold mb-4 text-primary">
              Analysis Result
            </h2>
            {result.success ? (
              <div className="space-y-4">
                <div>
                  <span className="font-semibold text-lg text-gradient-primary">
                    Food:
                  </span>
                  <span className="ml-2 text-lg font-bold">
                    {result.analysis.food_name}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Serving Size:</span>
                  <span className="ml-2">{result.analysis.serving_size}</span>
                </div>
                <div>
                  <span className="font-semibold">Calories per 100g:</span>
                  <span className="ml-2">
                    {result.analysis.calories_per_100g}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Macronutrients:</span>
                  <ul className="ml-4 mt-1 list-disc">
                    {Object.entries(result.analysis.macronutrients).map(
                      ([key, value]) => (
                        <li key={key} className="capitalize">
                          {key.replace(/_/g, " ").replace(/g$/, " (g)")}:{" "}
                          <span className="font-medium">{String(value)}</span>
                        </li>
                      )
                    )}
                  </ul>
                </div>
                <div>
                  <span className="font-semibold">Micronutrients:</span>
                  <ul className="ml-4 mt-1 list-disc">
                    {Object.entries(result.analysis.micronutrients).map(
                      ([key, value]) => (
                        <li key={key} className="capitalize">
                          {key
                            .replace(/_/g, " ")
                            .replace(/mg$/, " (mg)")
                            .replace(/ug$/, " (μg)")}
                          : <span className="font-medium">{String(value)}</span>
                        </li>
                      )
                    )}
                  </ul>
                </div>
                {result.analysis.note && (
                  <div className="italic text-sm text-muted-foreground mt-2">
                    {result.analysis.note}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-red-600 font-semibold text-lg">
                {result.error ||
                  "This image does not contain a recognizable food item."}
              </div>
            )}
            <Button
              onClick={handleNewUpload}
              className="bg-gradient-primary text-white font-semibold px-6 py-2 rounded-lg shadow-glow mt-6"
            >
              Upload Another Image
            </Button>
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="mt-8 w-full bg-red-100 dark:bg-red-900 rounded-xl shadow-lg p-6"
          >
            <h2 className="text-xl font-bold mb-2 text-red-600">Error</h2>
            <p className="text-base text-red-700 dark:text-red-300 mb-4">
              {error}
            </p>
            <Button
              onClick={handleNewUpload}
              className="bg-gradient-primary text-white font-semibold px-6 py-2 rounded-lg shadow-glow mt-2"
            >
              Try Again
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FoodAnalysis;
