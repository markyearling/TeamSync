import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Smartphone, 
  Download,
  QrCode,
  Apple,
  Play,
  Star,
  Shield,
  Zap,
  Bell,
  Camera,
  MapPin,
  Users,
  Calendar,
  CheckCircle,
  ArrowRight
} from 'lucide-react';

const MobileApps: React.FC = () => {
  const mobileFeatures = [
    {
      icon: Bell,
      title: 'Push Notifications',
      description: 'Get instant alerts for schedule changes, upcoming events, and messages from other parents.',
      color: 'text-orange-600'
    },
    {
      icon: Camera,
      title: 'Photo Integration',
      description: 'Take photos directly from your phone to update profile pictures and share moments.',
      color: 'text-purple-600'
    },
    {
      icon: MapPin,
      title: 'GPS Navigation',
      description: 'Tap any event location to get turn-by-turn directions using your preferred maps app.',
      color: 'text-blue-600'
    },
    {
      icon: Users,
      title: 'Offline Access',
      description: 'View your schedules even when you\'re offline. Perfect for areas with poor cell coverage.',
      color: 'text-green-600'
    },
    {
      icon: Zap,
      title: 'Pull to Refresh',
      description: 'Simply pull down on any screen to instantly sync the latest schedule updates.',
      color: 'text-yellow-600'
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Your family\'s data is encrypted and secure with biometric authentication support.',
      color: 'text-red-600'
    }
  ];

  const appStoreFeatures = [
    'Native iOS and Android performance',
    'Seamless sync with web version',
    'Optimized for mobile screens',
    'Background sync capabilities',
    'Biometric authentication',
    'Share schedules via native sharing'
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            <div className="text-center lg:text-left lg:w-1/2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 mb-6">
                <Smartphone className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
                FamSink Mobile Apps
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  Coming Soon
                </span>
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl lg:max-w-none leading-relaxed mb-8">
                Take your family's sports schedules with you everywhere. Our native mobile apps bring all the power 
                of FamSink to your iPhone and Android device with features designed specifically for mobile.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  to="/auth/signup"
                  className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
                >
                  Get Early Access
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </div>
            </div>
            
            {/* Phone Mockup */}
            <div className="lg:w-1/2 flex justify-center lg:justify-end">
              <div className="relative">
                <img 
                  src="/Simulator Screenshot - iPhone 16 Pro - 2025-08-30 at 10.39.22.png" 
                  alt="FamSink mobile app showing sports schedules on iPhone"
                  className="w-64 sm:w-80 md:w-96 lg:w-full max-w-md h-auto object-contain shadow-2xl rounded-3xl"
                />
                {/* Coming Soon Badge */}
                <div className="absolute -top-4 -right-4 bg-gradient-to-r from-green-400 to-emerald-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg transform rotate-12">
                  Coming Soon!
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile Features */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Mobile-First Features
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Our mobile apps are designed specifically for busy parents on the go, with features that make sense on your phone.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {mobileFeatures.map((feature, index) => (
              <div key={index} className="group p-8 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r ${
                  feature.color === 'text-blue-600' ? 'from-blue-100 to-blue-200' :
                  feature.color === 'text-green-600' ? 'from-green-100 to-green-200' :
                  feature.color === 'text-purple-600' ? 'from-purple-100 to-purple-200' :
                  feature.color === 'text-orange-600' ? 'from-orange-100 to-orange-200' :
                  feature.color === 'text-yellow-600' ? 'from-yellow-100 to-yellow-200' :
                  'from-red-100 to-red-200'
                } mb-6 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* App Store Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Download for iOS & Android
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Our mobile apps are currently in development. Sign up now to be notified when they're available!
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* App Store Cards */}
            <div className="space-y-6">
              {/* iOS App Store */}
              <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 opacity-60">
                <div className="flex items-center mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-gray-800 to-gray-900 flex items-center justify-center mr-4">
                    <Apple className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">iOS App Store</h3>
                    <p className="text-gray-600">Coming Soon for iPhone & iPad</p>
                  </div>
                </div>
                <div className="bg-gray-100 rounded-xl p-6 text-center">
                  <QrCode className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">QR Code Available Soon</p>
                  <p className="text-sm text-gray-400 mt-2">Scan to download from App Store</p>
                </div>
                <div className="mt-6">
                  <div className="bg-gray-100 rounded-lg px-4 py-3 text-center">
                    <span className="text-gray-500 font-medium">Download from App Store</span>
                  </div>
                </div>
              </div>

              {/* Google Play Store */}
              <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 opacity-60">
                <div className="flex items-center mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center mr-4">
                    <Play className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Google Play Store</h3>
                    <p className="text-gray-600">Coming Soon for Android</p>
                  </div>
                </div>
                <div className="bg-gray-100 rounded-xl p-6 text-center">
                  <QrCode className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">QR Code Available Soon</p>
                  <p className="text-sm text-gray-400 mt-2">Scan to download from Play Store</p>
                </div>
                <div className="mt-6">
                  <div className="bg-gray-100 rounded-lg px-4 py-3 text-center">
                    <span className="text-gray-500 font-medium">Get it on Google Play</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Features List */}
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                What to Expect
              </h3>
              <div className="space-y-4 mb-8">
                {appStoreFeatures.map((feature, index) => (
                  <div key={index} className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
              
              <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-3">Early Access Benefits</h4>
                <ul className="space-y-2 text-blue-800 text-sm">
                  <li className="flex items-start">
                    <Star className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Be among the first to experience FamSink mobile</span>
                  </li>
                  <li className="flex items-start">
                    <Star className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Provide feedback that shapes the final app</span>
                  </li>
                  <li className="flex items-start">
                    <Star className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Free access to all premium mobile features</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Development Timeline */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Development Timeline
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              We're working hard to bring FamSink to your mobile devices. Here's what to expect.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xl font-bold mb-6">
                ✓
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Phase 1: Web Platform</h3>
              <p className="text-gray-600 leading-relaxed">
                <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium mb-2">
                  Completed
                </span>
              </p>
              <p className="text-gray-600">
                Full-featured web application with all core functionality including calendar management, 
                platform integrations, and family sharing.
              </p>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xl font-bold mb-6">
                2
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Phase 2: Mobile Apps</h3>
              <p className="text-gray-600 leading-relaxed">
                <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium mb-2">
                  In Development
                </span>
              </p>
              <p className="text-gray-600">
                Native iOS and Android apps with push notifications, offline access, and mobile-optimized features. 
                Beta testing begins soon!
              </p>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-600 text-white text-xl font-bold mb-6">
                3
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Phase 3: Advanced Features</h3>
              <p className="text-gray-600 leading-relaxed">
                <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium mb-2">
                  Planned
                </span>
              </p>
              <p className="text-gray-600">
                Advanced analytics, team communication tools, carpool coordination, and other premium features 
                based on user feedback.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Beta Signup */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white rounded-3xl shadow-xl p-12 border border-gray-100">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 mb-8">
              <Bell className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
              Be the First to Know
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Sign up for FamSink today and we'll notify you the moment our mobile apps are available for download. 
              Plus, you'll get early access to beta testing!
            </p>
            <Link
              to="/auth/signup"
              className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
            >
              Sign Up for Early Access
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <p className="text-gray-500 text-sm mt-4">
              No credit card required • Free forever for core features
            </p>
          </div>
        </div>
      </section>

      {/* Technical Details */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Built with Modern Technology
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Our mobile apps are built using the latest technologies to ensure the best performance and user experience.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                Native Performance, Web Flexibility
              </h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <Zap className="h-5 w-5 text-yellow-600 mr-3" />
                  <span className="text-gray-700">Built with Capacitor for native performance</span>
                </div>
                <div className="flex items-center">
                  <Shield className="h-5 w-5 text-green-600 mr-3" />
                  <span className="text-gray-700">Same secure backend as the web app</span>
                </div>
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-blue-600 mr-3" />
                  <span className="text-gray-700">Seamless sync across all your devices</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-purple-600 mr-3" />
                  <span className="text-gray-700">Optimized for mobile screens and touch</span>
                </div>
              </div>
              <p className="text-gray-600 mt-6 leading-relaxed">
                We're using Capacitor to build truly native mobile apps that feel fast and responsive while 
                maintaining perfect sync with your web dashboard. The best of both worlds.
              </p>
            </div>
            
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <h4 className="font-semibold text-gray-900 mb-6 text-center">System Requirements</h4>
              
              <div className="space-y-6">
                <div>
                  <div className="flex items-center mb-3">
                    <Apple className="h-6 w-6 text-gray-700 mr-3" />
                    <span className="font-medium text-gray-900">iOS Requirements</span>
                  </div>
                  <ul className="text-sm text-gray-600 space-y-1 ml-9">
                    <li>• iOS 13.0 or later</li>
                    <li>• iPhone 6s or newer</li>
                    <li>• iPad (6th generation) or newer</li>
                    <li>• 50 MB available storage</li>
                  </ul>
                </div>
                
                <div>
                  <div className="flex items-center mb-3">
                    <Play className="h-6 w-6 text-gray-700 mr-3" />
                    <span className="font-medium text-gray-900">Android Requirements</span>
                  </div>
                  <ul className="text-sm text-gray-600 space-y-1 ml-9">
                    <li>• Android 6.0 (API level 23) or higher</li>
                    <li>• 2 GB RAM minimum</li>
                    <li>• 50 MB available storage</li>
                    <li>• Google Play Services</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Mobile App FAQ
            </h2>
            <p className="text-xl text-gray-600">
              Common questions about our upcoming mobile apps
            </p>
          </div>
          
          <div className="space-y-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                When will the mobile apps be available?
              </h3>
              <p className="text-gray-600">
                We're currently in active development and expect to release beta versions within the next few months. 
                Sign up for FamSink to be notified as soon as beta testing begins!
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Will the mobile apps cost extra?
              </h3>
              <p className="text-gray-600">
                No! Just like our web platform, the mobile apps will be completely free during our launch phase. 
                We want every family to have access to great sports schedule management tools.
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Will my data sync between web and mobile?
              </h3>
              <p className="text-gray-600">
                Absolutely! Your schedules, profiles, and settings will sync seamlessly between the web app and mobile apps. 
                Make a change on your phone, see it instantly on your computer.
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Can I use FamSink without the mobile apps?
              </h3>
              <p className="text-gray-600">
                Yes! Our web application is fully responsive and works great on mobile browsers. The native apps 
                will provide additional features like push notifications and offline access, but the web app is complete on its own.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Start Using FamSink Today
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Don't wait for the mobile apps - start organizing your family's sports life right now with our 
            full-featured web application. Mobile apps are just the cherry on top!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/auth/signup"
              className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-lg text-blue-600 bg-white hover:bg-gray-50 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
            >
              Get Started Free
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
            Web app available now • Mobile apps coming soon
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
                <li><Link to="/mobile-apps" className="hover:text-white transition-colors">Mobile Apps</Link></li>
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

export default MobileApps;