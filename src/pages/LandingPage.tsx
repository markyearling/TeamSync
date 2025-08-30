import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, 
  Users, 
  Smartphone, 
  Bell, 
  Shield, 
  Zap,
  CheckCircle,
  ArrowRight,
  Star,
  MessageSquare,
  Clock,
  MapPin,
  X
} from 'lucide-react';

const LandingPage: React.FC = () => {
  const features = [
    {
      icon: Calendar,
      title: 'Unified Calendar',
      description: 'View all your children\'s sports schedules in one place. Never miss a game or practice again.',
      color: 'text-blue-600'
    },
    {
      icon: Users,
      title: 'Platform Integration',
      description: 'Seamlessly connect with TeamSnap, SportsEngine, Playmetrics, and GameChanger.',
      color: 'text-green-600'
    },
    {
      icon: MessageSquare,
      title: 'Family Communication',
      description: 'Share schedules with family and friends. Chat and coordinate with other parents.',
      color: 'text-purple-600'
    },
    {
      icon: Bell,
      title: 'Smart Notifications',
      description: 'Get timely reminders for upcoming events. Never be caught off guard by schedule changes.',
      color: 'text-orange-600'
    },
    {
      icon: Smartphone,
      title: 'Mobile Ready',
      description: 'Access your schedules anywhere with our responsive web app and native mobile apps.',
      color: 'text-indigo-600'
    },
    {
      icon: Shield,
      title: 'Privacy First',
      description: 'Your family\'s data is secure. Control who sees what with granular privacy settings.',
      color: 'text-red-600'
    }
  ];

  const howItWorks = [
    {
      step: 1,
      title: 'Create Profiles',
      description: 'Add your children and their sports activities to get started.',
      icon: Users
    },
    {
      step: 2,
      title: 'Connect Platforms',
      description: 'Link your existing sports platform accounts to import schedules automatically.',
      icon: Zap
    },
    {
      step: 3,
      title: 'Share & Coordinate',
      description: 'Invite family members and friends to view schedules and stay coordinated.',
      icon: MessageSquare
    }
  ];

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Soccer Mom of 3',
      content: 'FamSink has been a game-changer for our family. Managing three kids\' soccer schedules used to be chaos. Now everything is organized in one place!',
      rating: 5
    },
    {
      name: 'Mike Chen',
      role: 'Baseball Dad',
      content: 'The TeamSnap integration is seamless. I love how I can share our schedule with grandparents so they never miss a game.',
      rating: 5
    },
    {
      name: 'Lisa Rodriguez',
      role: 'Multi-Sport Parent',
      content: 'Between basketball, swimming, and tennis, our calendar was overwhelming. FamSink made it simple and beautiful.',
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-white" />
              </div>
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
      <section className="relative hero-background-animated py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
              Your Family's Sports
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                Schedule Hub
              </span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              Stop juggling multiple apps and calendars. FamSink brings all your children's sports schedules together in one beautiful, easy-to-use platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/auth/signup"
                className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <button className="inline-flex items-center px-8 py-4 border border-gray-300 text-lg font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 shadow-md hover:shadow-lg transition-all">
                Watch Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Stay Organized
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              FamSink combines powerful features with an intuitive design to make managing your family's sports life effortless.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="group p-8 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r ${
                  feature.color === 'text-blue-600' ? 'from-blue-100 to-blue-200' :
                  feature.color === 'text-green-600' ? 'from-green-100 to-green-200' :
                  feature.color === 'text-purple-600' ? 'from-purple-100 to-purple-200' :
                  feature.color === 'text-orange-600' ? 'from-orange-100 to-orange-200' :
                  feature.color === 'text-indigo-600' ? 'from-indigo-100 to-indigo-200' :
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

      {/* How It Works Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How FamSink Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Get up and running in minutes with our simple three-step process.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {howItWorks.map((step, index) => (
              <div key={index} className="text-center">
                <div className="relative mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xl font-bold mb-4">
                    {step.step}
                  </div>
                  <div className="absolute top-8 left-1/2 transform -translate-x-1/2 translate-y-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white shadow-lg border border-gray-100">
                      <step.icon className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                  {index < howItWorks.length - 1 && (
                    <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-blue-200 to-transparent transform translate-y-0"></div>
                  )}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-8">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                Tired of Juggling Multiple Sports Apps?
              </h2>
              <div className="space-y-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center mt-1">
                    <X className="h-4 w-4 text-red-600" />
                  </div>
                  <p className="ml-4 text-gray-600">Switching between TeamSnap, SportsEngine, and other apps</p>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center mt-1">
                    <X className="h-4 w-4 text-red-600" />
                  </div>
                  <p className="ml-4 text-gray-600">Missing important schedule changes and updates</p>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center mt-1">
                    <X className="h-4 w-4 text-red-600" />
                  </div>
                  <p className="ml-4 text-gray-600">Difficulty coordinating with family members and carpools</p>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                FamSink Solves This
              </h3>
              <div className="space-y-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mt-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="ml-4 text-gray-600">One unified dashboard for all sports platforms</p>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mt-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="ml-4 text-gray-600">Real-time notifications for schedule updates</p>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mt-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="ml-4 text-gray-600">Easy sharing and communication with family</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Built for Busy Sports Families
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              See how FamSink transforms the way families manage their sports schedules.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                Dashboard That Makes Sense
              </h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-blue-600 mr-3" />
                  <span className="text-gray-700">Today's schedule at a glance</span>
                </div>
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-green-600 mr-3" />
                  <span className="text-gray-700">All children's activities in one view</span>
                </div>
                <div className="flex items-center">
                  <Bell className="h-5 w-5 text-orange-600 mr-3" />
                  <span className="text-gray-700">Upcoming events and notifications</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900">Today's Schedule</h4>
                  <span className="text-sm text-blue-600 font-medium">3 Events</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center p-3 bg-blue-50 rounded-lg">
                    <div className="w-3 h-3 rounded-full bg-blue-600 mr-3"></div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">Soccer Practice</p>
                      <p className="text-sm text-gray-600">Emma • 4:00 PM - 5:30 PM</p>
                    </div>
                  </div>
                  <div className="flex items-center p-3 bg-green-50 rounded-lg">
                    <div className="w-3 h-3 rounded-full bg-green-600 mr-3"></div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">Baseball Game</p>
                      <p className="text-sm text-gray-600">Jack • 6:00 PM - 8:00 PM</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">Connected Platforms</h4>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center p-3 bg-orange-50 rounded-lg">
                      <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                        <Users className="h-4 w-4 text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">TeamSnap</p>
                        <p className="text-sm text-gray-600">3 teams synced</p>
                      </div>
                    </div>
                    <div className="flex items-center p-3 bg-blue-50 rounded-lg">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                        <Calendar className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">SportsEngine</p>
                        <p className="text-sm text-gray-600">2 teams synced</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                Seamless Platform Integration
              </h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <Zap className="h-5 w-5 text-yellow-600 mr-3" />
                  <span className="text-gray-700">Automatic sync with your existing platforms</span>
                </div>
                <div className="flex items-center">
                  <Shield className="h-5 w-5 text-green-600 mr-3" />
                  <span className="text-gray-700">Secure OAuth connections</span>
                </div>
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-blue-600 mr-3" />
                  <span className="text-gray-700">Real-time updates when schedules change</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Loved by Sports Families
            </h2>
            <p className="text-xl text-gray-600">
              Join thousands of families who have simplified their sports life with FamSink.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 leading-relaxed italic">
                  "{testimonial.content}"
                </p>
                <div>
                  <p className="font-semibold text-gray-900">{testimonial.name}</p>
                  <p className="text-sm text-gray-600">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to Simplify Your Sports Life?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of families who have already made the switch to FamSink. Get started today and never miss another game.
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
            No credit card required • Free forever for basic features
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center mb-4">
                <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
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
                <li><Link to="/auth/signup" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link to="/auth/signup" className="hover:text-white transition-colors">Pricing</Link></li>
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

export default LandingPage;