import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, Target, Users, Sparkles } from 'lucide-react';

const About = () => {
  const features = [
    {
      icon: Target,
      title: "Personalized Nutrition",
      description: "AI-powered meal planning tailored to your dietary preferences, health goals, and lifestyle."
    },
    {
      icon: Heart,
      title: "Health-Focused",
      description: "Every recommendation is designed to support your wellness journey and nutritional needs."
    },
    {
      icon: Users,
      title: "Community Driven",
      description: "Join thousands of users on their path to better health through smart nutrition choices."
    },
    {
      icon: Sparkles,
      title: "Smart Technology",
      description: "Advanced AI algorithms analyze your preferences to create the perfect meal plans."
    }
  ];

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <Badge variant="secondary" className="mb-4">About OVIYA</Badge>
          <h1 className="text-4xl md:text-6xl font-bold text-gradient-primary mb-6">
            Your AI Nutrition Companion
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            OVIYA revolutionizes meal planning with intelligent AI technology, creating personalized 
            nutrition plans that adapt to your unique lifestyle, preferences, and health goals.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-16"
        >
          <Card className="shadow-glow border-0 bg-gradient-card">
            <CardHeader>
              <CardTitle className="text-2xl text-center text-gradient-secondary">Our Mission</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-lg text-muted-foreground leading-relaxed">
                To make healthy eating accessible, enjoyable, and sustainable for everyone through 
                the power of artificial intelligence and personalized nutrition science.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 * index }}
            >
              <Card className="h-full shadow-glow border-0 bg-gradient-card hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-primary/20">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center"
        >
          <Card className="shadow-glow border-0 bg-gradient-card">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold text-gradient-primary mb-4">
                Why Choose OVIYA?
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <div>
                  <h4 className="font-semibold text-primary mb-2">Smart Algorithms</h4>
                  <p className="text-sm text-muted-foreground">
                    Our AI learns from your preferences and continuously improves recommendations.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-primary mb-2">Evidence-Based</h4>
                  <p className="text-sm text-muted-foreground">
                    All recommendations are backed by nutritional science and dietary guidelines.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-primary mb-2">User-Friendly</h4>
                  <p className="text-sm text-muted-foreground">
                    Intuitive design makes healthy meal planning effortless and enjoyable.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default About;