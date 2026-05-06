import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReactSelect from "react-select";
import { Weight, Ruler, Calculator } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateProfile, completeOnboarding } from "@/store/slices/userSlice";
import { useToast } from "@/hooks/use-toast";

const countries = [
  "Pakistan",
  "United States",
  "Canada",
  "United Kingdom",
  "Australia",
  "Germany",
  "France",
  "India",
  "Japan",
  "Brazil",
  "Mexico",
];

const Onboarding = () => {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const { isAuthenticated, user: authUser } = useAppSelector(
    (state) => state.auth
  );
  const { onboardingComplete } = useAppSelector((state) => state.user);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    location: "",
    weight: { value: "", unit: "kg" as "kg" | "lbs" },
    height: { value: "", unit: "cm" as "cm" | "ft", inches: "" },
  });

  const [bmi, setBmi] = useState<number | null>(null);

  // Autofill names from auth and lock them
  useEffect(() => {
    if (authUser) {
      setFormData((prev) => ({
        ...prev,
        firstName: authUser.firstName || "",
        lastName: authUser.lastName || "",
      }));
    }
  }, [authUser]);

  useEffect(() => {
    if (formData.weight.value && formData.height.value) {
      const weightNum = parseFloat(formData.weight.value);
      const heightNum = parseFloat(formData.height.value);
      const inchesNum =
        formData.height.unit === "ft"
          ? parseFloat(formData.height.inches || "0")
          : 0;

      if (weightNum > 0 && heightNum > 0) {
        let weightInKg =
          formData.weight.unit === "kg" ? weightNum : weightNum * 0.453592;
        let heightInM =
          formData.height.unit === "cm"
            ? heightNum / 100
            : (heightNum * 12 + inchesNum) * 0.0254;
        const calculatedBMI =
          Math.round((weightInKg / (heightInM * heightInM)) * 10) / 10;
        setBmi(calculatedBMI);
      } else {
        setBmi(null);
      }
    } else {
      setBmi(null);
    }
  }, [formData.weight, formData.height]);

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (onboardingComplete) {
    return <Navigate to="/chat" replace />;
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = () => {
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.location ||
      !formData.weight.value ||
      !formData.height.value ||
      !bmi
    ) {
      toast({
        title: "Missing Information",
        description: "All fields are required, including a valid BMI.",
        variant: "destructive",
      });
      return;
    }

    const profileData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      location: formData.location,
      weight: {
        value: parseFloat(formData.weight.value),
        unit: formData.weight.unit,
      },
      height: {
        value: parseFloat(formData.height.value),
        unit: formData.height.unit,
        inches:
          formData.height.unit === "ft"
            ? parseFloat(formData.height.inches || "0")
            : undefined,
      },
      bmi,
    } as any;

    dispatch(updateProfile(profileData));
    dispatch(completeOnboarding());

    toast({
      title: "Profile Updated!",
      description: "Your details have been saved successfully.",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-bg px-4 pt-24 pb-12">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="shadow-glow border-0 bg-gradient-card">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-gradient-primary">
                Let's get to know you better!
              </CardTitle>
              <p className="text-muted-foreground">
                Help us create the perfect meal plan just for you
              </p>
            </CardHeader>

            <CardContent className="space-y-8">
              {/* Basic Information */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      placeholder="Enter your first name"
                      value={formData.firstName}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Enter your last name"
                      value={formData.lastName}
                      disabled
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <div className="relative">
                    <ReactSelect
                      placeholder="Select your country"
                      isSearchable
                      options={countries.map((country) => ({
                        value: country,
                        label: country,
                      }))}
                      onChange={(option) =>
                        handleInputChange("location", option?.value || "")
                      }
                      styles={{
                        control: (base) => ({
                          ...base,
                          backgroundColor: "hsl(var(--background))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "0.5rem",
                          padding: "0.25rem",
                          minHeight: "2.5rem",
                        }),
                        menu: (base) => ({
                          ...base,
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.5rem",
                          zIndex: 50,
                        }),
                        option: (base, state) => ({
                          ...base,
                          backgroundColor: state.isFocused
                            ? "hsl(var(--muted))"
                            : "transparent",
                          color: "hsl(var(--foreground))",
                          cursor: "pointer",
                        }),
                        singleValue: (base) => ({
                          ...base,
                          color: "hsl(var(--foreground))",
                        }),
                        placeholder: (base) => ({
                          ...base,
                          color: "hsl(var(--muted-foreground))",
                        }),
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Weight and Height */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Label>Weight</Label>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">{formData.weight.unit}</span>
                  </div>
                  <div className="relative">
                    <Weight className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder={`Weight in ${formData.weight.unit}`}
                      value={formData.weight.value}
                      onChange={(e) =>
                        handleInputChange("weight", {
                          ...formData.weight,
                          value: e.target.value,
                        })
                      }
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <Label>Height</Label>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">{formData.height.unit}</span>
                  </div>
                  <div className="flex space-x-2">
                    <div className="relative flex-1">
                      <Ruler className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        placeholder={
                          formData.height.unit === "cm"
                            ? "Height in cm"
                            : "Feet"
                        }
                        value={formData.height.value}
                        onChange={(e) =>
                          handleInputChange("height", {
                            ...formData.height,
                            value: e.target.value,
                          })
                        }
                        className="pl-10"
                      />
                    </div>
                    {formData.height.unit === "ft" && (
                      <Input
                        type="number"
                        placeholder="Inches"
                        value={formData.height.inches}
                        onChange={(e) =>
                          handleInputChange("height", {
                            ...formData.height,
                            inches: e.target.value,
                          })
                        }
                        className="w-24"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* BMI Display */}
              {bmi && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 rounded-lg bg-gradient-primary/10 border border-primary/20"
                >
                  <div className="flex items-center space-x-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    <span className="font-medium">Your BMI: </span>
                    <span className="text-lg font-bold text-gradient-primary">
                      {bmi}
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Submit Button */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={handleSubmit}
                  className="w-full bg-gradient-primary text-lg py-6 hover-lift hover-glow"
                  size="lg"
                >
                  Continue to Chat
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Onboarding;
