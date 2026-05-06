import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Target, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import BackgroundSlider from "@/components/ui/background-slider";

const Landing = () => {
  return (
    <BackgroundSlider>
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-4xl mx-auto">
          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight"
          >
            <span className="text-gradient-hero text-9xl">OVIYA</span>
            <br />
            <span className="text-white font-thin">AI Powered Nutrition</span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed font-light"
          >
            Personalized, macro-smart weekly meal plans—
            <br className="hidden sm:block" />
            dietary and allergen safe.
          </motion.p>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-wrap justify-center gap-6 mb-10"
          >
            <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-white font-medium">AI-Powered</span>
            </div>
            <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
              <Target className="h-5 w-5 text-secondary" />
              <span className="text-white font-medium">Personalized</span>
            </div>
            <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
              <Clock className="h-5 w-5 text-accent" />
              <span className="text-white font-medium">Weekly Plans</span>
            </div>
          </motion.div>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link to="/auth">
              <Button
                size="lg"
                className="bg-gradient-primary text-white font-semibold text-lg px-8 py-4 rounded-full shadow-glow hover-lift w-72 h-14"
              >
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </motion.div>

          {/* Floating Elements */}
          <motion.div
            animate={{ y: [-10, 10, -10] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-20 left-10 hidden lg:block"
          >
            <div className="w-16 h-16 bg-primary/20 rounded-full blur-xl" />
          </motion.div>

          <motion.div
            animate={{ y: [10, -10, 10] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-32 right-10 hidden lg:block"
          >
            <div className="w-20 h-20 bg-secondary/20 rounded-full blur-xl" />
          </motion.div>
        </div>
      </div>
    </BackgroundSlider>
  );
};

export default Landing;
