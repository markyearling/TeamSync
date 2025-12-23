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
    <>
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
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-green-600">
                  Now Available on iOS & Android
                </span>
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl lg:max-w-none leading-relaxed mb-8">
                Take your family's sports schedules with you everywhere. Download our native apps
                with all the power of FamSink optimized for your iPhone, iPad, and Android devices.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <a
                  href="https://apps.apple.com/us/app/famsink/id6747955517"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
                >
                  <Apple className="mr-2 h-5 w-5" />
                  Download on App Store
                </a>
                <a
                  href="https://play.google.com/store/apps/details?id=com.yearling.famsink&pcampaignid=web_share"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-lg text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
                >
                  <Play className="mr-2 h-5 w-5" />
                  Get it on Google Play
                </a>
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
                {/* Available Now Badge */}
                <div className="absolute -top-4 -right-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg transform rotate-12">
                  Available Now!
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
              Download FamSink Today
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Available now on iOS and Android with full mobile features!
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* App Store Cards */}
            <div className="space-y-6">
              {/* iOS App Store */}
              <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-blue-200 hover:border-blue-300 transition-colors">
                <div className="flex items-center mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-gray-800 to-gray-900 flex items-center justify-center mr-4">
                    <Apple className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold text-gray-900">iOS App Store</h3>
                      <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                        LIVE
                      </span>
                    </div>
                    <p className="text-green-600 font-medium">Available Now for iPhone & iPad</p>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-8 text-center border border-blue-100">
                  <p className="text-gray-700 font-semibold mb-4 text-lg">Scan to Download</p>
                  <img
                    src="/ios-app-qr.png"
                    alt="Scan QR code to download FamSink from iOS App Store"
                    className="w-48 h-48 mx-auto mb-4 object-contain"
                  />
                  <p className="text-gray-600 text-sm">Point your iPhone camera at the QR code</p>
                  <p className="text-gray-500 text-sm mt-1">to install FamSink instantly</p>
                </div>
                <div className="mt-6">
                  <a
                    href="https://apps.apple.com/us/app/famsink/id6747955517"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg px-6 py-4 text-center font-semibold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
                  >
                    <Apple className="inline-block h-5 w-5 mr-2 mb-1" />
                    Download from App Store
                  </a>
                </div>
              </div>

              {/* Google Play Store */}
              <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-green-200 hover:border-green-300 transition-colors">
                <div className="flex items-center mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center mr-4">
                    <Play className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold text-gray-900">Google Play Store</h3>
                      <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                        LIVE
                      </span>
                    </div>
                    <p className="text-green-600 font-medium">Available Now for Android</p>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-8 text-center border border-green-100">
                  <p className="text-gray-700 font-semibold mb-4 text-lg">Scan to Download</p>
                  <img
                    src="/famsink_android.png"
                    alt="Scan QR code to download FamSink from Google Play Store"
                    className="w-48 h-48 mx-auto mb-4 object-contain"
                  />
                  <p className="text-gray-600 text-sm">Point your Android camera at the QR code</p>
                  <p className="text-gray-500 text-sm mt-1">to install FamSink instantly</p>
                </div>
                <div className="mt-6">
                  <a
                    href="https://play.google.com/store/apps/details?id=com.yearling.famsink&pcampaignid=web_share"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg px-6 py-4 text-center font-semibold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
                  >
                    <Play className="inline-block h-5 w-5 mr-2 mb-1" />
                    Get it on Google Play
                  </a>
                </div>
              </div>
            </div>

            {/* Features List */}
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                Mobile App Features
              </h3>
              <div className="space-y-4 mb-8">
                {appStoreFeatures.map((feature, index) => (
                  <div key={index} className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                <h4 className="font-semibold text-green-900 mb-3 flex items-center">
                  <Star className="h-5 w-5 text-green-600 mr-2" />
                  Why Download Now
                </h4>
                <ul className="space-y-2 text-green-800 text-sm">
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Access your family's schedule anywhere, anytime</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Get instant push notifications for schedule changes</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Native iOS performance with offline access</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Free to use with all features included</span>
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
              Platform Availability
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Track our progress bringing FamSink to all your devices
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xl font-bold mb-6">
                ✓
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Web Platform</h3>
              <p className="text-gray-600 leading-relaxed">
                <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium mb-2">
                  Available Now
                </span>
              </p>
              <p className="text-gray-600">
                Full-featured web application with all core functionality including calendar management,
                platform integrations, and family sharing.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xl font-bold mb-6">
                ✓
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">iOS App</h3>
              <p className="text-gray-600 leading-relaxed">
                <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium mb-2">
                  Available Now
                </span>
              </p>
              <p className="text-gray-600">
                Native iOS app for iPhone and iPad with push notifications, offline access, and all web features
                optimized for mobile.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xl font-bold mb-6">
                ✓
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Android App</h3>
              <p className="text-gray-600 leading-relaxed">
                <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium mb-2">
                  Available Now
                </span>
              </p>
              <p className="text-gray-600">
                Native Android app with all the same features as iOS including push notifications, offline access, and seamless sync.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Download CTA */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white rounded-3xl shadow-xl p-12 border border-gray-100">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-r from-blue-500 to-green-500 mb-8">
              <Smartphone className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
              Download FamSink Today
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Get the full FamSink experience on your iOS or Android device. Download now
              and start managing your family's sports schedules on the go!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://apps.apple.com/us/app/famsink/id6747955517"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
              >
                <Apple className="mr-2 h-5 w-5" />
                Download on App Store
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.yearling.famsink&pcampaignid=web_share"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-lg text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
              >
                <Play className="mr-2 h-5 w-5" />
                Get it on Google Play
              </a>
              <Link
                to="/auth/signup"
                className="inline-flex items-center px-8 py-4 border-2 border-blue-600 text-lg font-medium rounded-lg text-blue-600 hover:bg-blue-50 transition-all"
              >
                Create Free Account
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
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
                Is the iOS app available now?
              </h3>
              <p className="text-gray-600">
                Yes! The FamSink iOS app is live on the App Store. Download it now for free and get the full
                FamSink experience on your iPhone or iPad with push notifications and offline access.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Is the Android app available now?
              </h3>
              <p className="text-gray-600">
                Yes! The FamSink Android app is live on the Google Play Store. Download it now for free and get the full
                FamSink experience on your Android device with push notifications and offline access.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Do the mobile apps cost extra?
              </h3>
              <p className="text-gray-600">
                No! Both the iOS and Android apps are completely free to download and use, just like our web platform.
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
                Can I use FamSink without the mobile app?
              </h3>
              <p className="text-gray-600">
                Yes! Our web application is fully responsive and works great on mobile browsers. The native mobile apps
                provide additional features like push notifications and offline access, but the web app is fully functional on its own.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Get Started with FamSink
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Available now on web, iOS, and Android. Start organizing your family's sports life today with our
            full-featured platform across all your devices!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://apps.apple.com/us/app/famsink/id6747955517"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-lg text-blue-600 bg-white hover:bg-gray-50 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
            >
              <Apple className="mr-2 h-5 w-5" />
              Download iOS App
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.yearling.famsink&pcampaignid=web_share"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-lg text-blue-600 bg-white hover:bg-gray-50 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
            >
              <Play className="mr-2 h-5 w-5" />
              Download Android App
            </a>
            <Link
              to="/auth/signup"
              className="inline-flex items-center px-8 py-4 border-2 border-white text-lg font-medium rounded-lg text-white hover:bg-white hover:text-blue-600 transition-all"
            >
              Sign Up Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
          <p className="text-blue-200 text-sm mt-4">
            iOS app available • Android app available • Web app available
          </p>
        </div>
      </section>

      
    </>
  );
};

export default MobileApps;