import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Check, 
  Star,
  Heart,
  Zap,
  Shield,
  Users,
  Calendar,
  Bell,
  Smartphone,
  ArrowRight
} from 'lucide-react';

const Pricing: React.FC = () => {
  const features = [
    {
      icon: Calendar,
      title: 'Unlimited Schedules',
      description: 'Connect all your sports platforms and manage unlimited events'
    },
    {
      icon: Users,
      title: 'Unlimited Children',
      description: 'Create profiles for all your children and their activities'
    },
    {
      icon: Bell,
      title: 'Smart Notifications',
      description: 'Get timely reminders and schedule change alerts'
    },
    {
      icon: Smartphone,
      title: 'Mobile Apps',
      description: 'Access your schedules on iOS and Android devices'
    },
    {
      icon: Shield,
      title: 'Privacy Controls',
      description: 'Granular sharing and privacy settings for your family'
    },
    {
      icon: Zap,
      title: 'Platform Integration',
      description: 'Connect with TeamSnap, SportsEngine, Playmetrics, and more'
    }
  ];

  const futureFeatures = [
    'Advanced analytics and insights',
    'Team communication tools',
    'Carpool coordination',
    'Equipment and gear tracking',
    'Tournament bracket management',
    'Coach and referee scheduling'
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-[env(safe-area-inset-top)]">
          <div className="flex justify-between items-center py-4">
            <Link 
              to="/" 
              className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
            <div className="flex items-center">
              <img 
                src="/famsink-new-logo.png" 
                alt="FamSink Logo" 
                className="h-8 w-8 rounded-full object-cover"
              />
              <span className="ml-3 text-2xl font-bold text-gray-900">FamSink</span>
            </div>
            <Link
              to="/auth/signin"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-100 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 mb-6">
            <Heart className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Simple Pricing for
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              Every Family
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed mb-8">
            We're launching FamSink with everything completely free because we want families to fall in love with 
            organized sports scheduling. No hidden fees, no credit card required.
          </p>
          <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            <Star className="h-4 w-4 mr-2" />
            Launch Special - Everything Free!
          </div>
        </div>
      </section>

      {/* Main Pricing Card */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-3xl shadow-xl border border-blue-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-center">
              <h2 className="text-2xl font-bold text-white mb-2">FamSink Free</h2>
              <p className="text-blue-100">Everything you need to get started</p>
            </div>
            
            <div className="px-8 py-12">
              <div className="text-center mb-12">
                <div className="flex items-center justify-center mb-4">
                  <span className="text-6xl font-bold text-gray-900">$0</span>
                  <span className="text-xl text-gray-500 ml-2">/month</span>
                </div>
                <p className="text-lg text-gray-600 mb-8">
                  Complete access to all current features while we perfect the platform
                </p>
                <Link
                  to="/auth/signup"
                  className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-r from-blue-100 to-indigo-200 flex items-center justify-center mr-4">
                      <feature.icon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">{feature.title}</h4>
                      <p className="text-gray-600 text-sm">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Future Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              What's Coming Next
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              We're constantly working on new features to make FamSink even better. Here's what we're planning.
            </p>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
            <div className="flex items-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r from-purple-100 to-pink-200 mr-4">
                <Zap className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Premium Features (Coming Soon)</h3>
                <p className="text-gray-600">Advanced tools for power users and larger families</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {futureFeatures.map((feature, index) => (
                <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mr-3"></div>
                  <span className="text-gray-700 text-sm">{feature}</span>
                </div>
              ))}
            </div>
            
            <div className="mt-8 p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
              <h4 className="font-semibold text-purple-900 mb-2">Our Commitment</h4>
              <p className="text-purple-800 text-sm leading-relaxed">
                We believe in earning your trust first. That's why we're launching with everything free. 
                As we add premium features, existing users will always have access to the core functionality 
                that makes FamSink special - completely free, forever.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-600">
              Everything you need to know about FamSink pricing
            </p>
          </div>
          
          <div className="space-y-8">
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Is FamSink really completely free?
              </h3>
              <p className="text-gray-600">
                Yes! During our launch phase, all features are completely free. No credit card required, 
                no hidden fees, no trial periods. We want families to experience the full power of FamSink.
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Will there be paid plans in the future?
              </h3>
              <p className="text-gray-600">
                Eventually, we may introduce premium features for advanced users, but the core functionality 
                you love will always remain free. We believe every family deserves access to organized sports scheduling.
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                How many children and events can I add?
              </h3>
              <p className="text-gray-600">
                There are no limits! Add as many children, sports, teams, and events as you need. 
                FamSink is designed to scale with your family's activities.
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Can I connect multiple sports platforms?
              </h3>
              <p className="text-gray-600">
                Absolutely! Connect TeamSnap, SportsEngine, Playmetrics, GameChanger, and more. 
                All your schedules will sync automatically into one unified calendar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to Get Organized?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of families who are already using FamSink to simplify their sports life. 
            Start your free account today - no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/auth/signup"
              className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-lg text-blue-600 bg-white hover:bg-gray-50 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
            >
              Start Free Today
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link
              to="/auth/signin"
              className="inline-flex items-center px-8 py-4 border-2 border-white text-lg font-medium rounded-lg text-white hover:bg-white hover:text-blue-600 transition-all"
            >
              Sign In
            </Link>
          </div>
          <p className="text-blue-200 text-sm mt-4">
            No credit card required • Free forever for core features
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center mb-4">
                <img 
                  src="/famsink-new-logo.png" 
                  alt="FamSink Logo" 
                  className="h-8 w-8 rounded-full object-cover"
                />
                <span className="ml-3 text-xl font-bold">FamSink</span>
              </div>
              <p className="text-gray-400 mb-4 max-w-md">
                The ultimate family sports schedule management app. Simplifying youth sports for busy families everywhere.
              </p>
              <p className="text-gray-500 text-sm">
                Proudly based in Grafton, WI
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link to="/auth/signup" className="hover:text-white transition-colors">Mobile Apps</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/help" className="hover:text-white transition-colors">Help Center</Link></li>
                <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><a href="mailto:support@famsink.com" className="hover:text-white transition-colors">Contact Us</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 FamSink. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;