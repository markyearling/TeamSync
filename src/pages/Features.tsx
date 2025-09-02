import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Calendar, 
  Users, 
  Smartphone, 
  Bell, 
  Shield, 
  Clock,
  MessageSquare,
  CheckCircle,
  Star,
  Zap
} from 'lucide-react';

const Features: React.FC = () => {
  const features = [
    {
      icon: Calendar,
      title: 'Unified Calendar',
      description: 'View all your children\'s sports schedules in one place. Never miss a game or practice again.',
      color: 'text-blue-600',
      bgColor: 'from-blue-100 to-blue-200',
      benefits: [
        'See all events from multiple platforms in one view',
        'Color-coded by child and sport for easy identification',
        'Multiple calendar views: month, week, day, and agenda',
        'Quick event details with location and timing'
      ]
    },
    {
      icon: Users,
      title: 'Platform Integration',
      description: 'Seamlessly connect with TeamSnap, SportsEngine, Playmetrics, and GameChanger.',
      color: 'text-green-600',
      bgColor: 'from-green-100 to-green-200',
      benefits: [
        'Automatic sync with existing sports platforms',
        'Real-time updates when schedules change',
        'No manual data entry required',
        'Secure OAuth connections protect your data'
      ]
    },
    {
      icon: MessageSquare,
      title: 'Family Communication',
      description: 'Share schedules with family and friends. Chat and coordinate with other parents.',
      color: 'text-purple-600',
      bgColor: 'from-purple-100 to-purple-200',
      benefits: [
        'Share schedules with grandparents and family',
        'Built-in messaging with other parents',
        'Coordinate carpools and logistics',
        'Granular privacy controls for sharing'
      ]
    },
    {
      icon: Bell,
      title: 'Smart Notifications',
      description: 'Get timely reminders for upcoming events. Never be caught off guard by schedule changes.',
      color: 'text-orange-600',
      bgColor: 'from-orange-100 to-orange-200',
      benefits: [
        'Customizable notification timing (15 minutes to 1 day ahead)',
        'Push notifications on mobile devices',
        'Schedule change alerts in real-time',
        'Event reminders with location details'
      ]
    },
    {
      icon: Smartphone,
      title: 'Mobile Ready',
      description: 'Access your schedules anywhere with our responsive web app and native mobile apps.',
      color: 'text-indigo-600',
      bgColor: 'from-indigo-100 to-indigo-200',
      benefits: [
        'Native iOS and Android apps via Capacitor',
        'Responsive design works on any device',
        'Offline access to your schedules',
        'Pull-to-refresh for instant updates'
      ]
    },
    {
      icon: Shield,
      title: 'Privacy First',
      description: 'Your family\'s data is secure. Control who sees what with granular privacy settings.',
      color: 'text-red-600',
      bgColor: 'from-red-100 to-red-200',
      benefits: [
        'End-to-end encryption for sensitive data',
        'Role-based access control (viewer, admin)',
        'Private events visible only to you',
        'GDPR compliant data handling'
      ]
    },
    {
      icon: Clock,
      title: 'Personal Event Planner',
      description: 'Add and manage your own family events beyond sports. Birthday parties, school events, family trips - keep everything organized in one place.',
      color: 'text-teal-600',
      bgColor: 'from-teal-100 to-teal-200',
      benefits: [
        'Create custom events for any occasion',
        'Set event visibility (public or private)',
        'Add detailed descriptions and locations',
        'Integrate with Google Maps for directions'
      ]
    }
  ];

  const additionalFeatures = [
    {
      icon: Star,
      title: 'Multi-Child Management',
      description: 'Manage schedules for multiple children with different sports and activities',
      items: [
        'Individual profiles for each child',
        'Custom colors and photos for easy identification',
        'Sport-specific activity tracking',
        'Age-appropriate event filtering'
      ]
    },
    {
      icon: Zap,
      title: 'Automation & Efficiency',
      description: 'Save time with intelligent automation and smart features',
      items: [
        'Automatic event import from connected platforms',
        'Smart duplicate detection and merging',
        'Bulk operations for managing multiple events',
        'Quick actions for common tasks'
      ]
    },
    {
      icon: CheckCircle,
      title: 'Reliability & Performance',
      description: 'Built for busy families who need dependable technology',
      items: [
        'Real-time synchronization across devices',
        '99.9% uptime with cloud infrastructure',
        'Fast loading times and smooth interactions',
        'Automatic backup and data recovery'
      ]
    }
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
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Everything You Need to Stay
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              Organized
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            FamSink combines powerful features with an intuitive design to make managing your family's sports life effortless. 
            Discover how our comprehensive platform can transform the way you handle youth sports schedules.
          </p>
        </div>
      </section>

      {/* Main Features */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Core Features
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Every feature is designed with busy sports families in mind, providing the tools you need to stay organized and connected.
            </p>
          </div>
          
          <div className="space-y-20">
            {features.map((feature, index) => (
              <div key={index} className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-12`}>
                <div className="lg:w-1/2">
                  <div className="flex items-center mb-6">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r ${feature.bgColor} mr-4`}>
                      <feature.icon className={`h-8 w-8 ${feature.color}`} />
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900">{feature.title}</h3>
                  </div>
                  <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                    {feature.description}
                  </p>
                  <div className="space-y-3">
                    {feature.benefits.map((benefit, benefitIndex) => (
                      <div key={benefitIndex} className="flex items-start">
                        <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="lg:w-1/2">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 shadow-lg">
                    <div className="bg-white rounded-xl p-6 shadow-md">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-900">{feature.title} in Action</h4>
                        <feature.icon className={`h-6 w-6 ${feature.color}`} />
                      </div>
                      <div className="space-y-3">
                        {feature.title === 'Unified Calendar' && (
                          <>
                            <div className="flex items-center p-3 bg-blue-50 rounded-lg">
                              <div className="w-3 h-3 rounded-full bg-blue-600 mr-3"></div>
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">Soccer Practice</p>
                                <p className="text-sm text-gray-600">Emma • Today 4:00 PM</p>
                              </div>
                            </div>
                            <div className="flex items-center p-3 bg-green-50 rounded-lg">
                              <div className="w-3 h-3 rounded-full bg-green-600 mr-3"></div>
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">Baseball Game</p>
                                <p className="text-sm text-gray-600">Jack • Tomorrow 6:00 PM</p>
                              </div>
                            </div>
                          </>
                        )}
                        {feature.title === 'Platform Integration' && (
                          <>
                            <div className="flex items-center p-3 bg-orange-50 rounded-lg">
                              <Users className="h-4 w-4 text-orange-600 mr-3" />
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">TeamSnap</p>
                                <p className="text-sm text-gray-600">3 teams connected</p>
                              </div>
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </div>
                            <div className="flex items-center p-3 bg-blue-50 rounded-lg">
                              <Calendar className="h-4 w-4 text-blue-600 mr-3" />
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">SportsEngine</p>
                                <p className="text-sm text-gray-600">2 teams connected</p>
                              </div>
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </div>
                          </>
                        )}
                        {feature.title === 'Smart Notifications' && (
                          <>
                            <div className="flex items-center p-3 bg-orange-50 rounded-lg">
                              <Bell className="h-4 w-4 text-orange-600 mr-3" />
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">Game Reminder</p>
                                <p className="text-sm text-gray-600">Soccer game in 1 hour</p>
                              </div>
                            </div>
                            <div className="flex items-center p-3 bg-yellow-50 rounded-lg">
                              <Clock className="h-4 w-4 text-yellow-600 mr-3" />
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">Schedule Change</p>
                                <p className="text-sm text-gray-600">Practice moved to 5:00 PM</p>
                              </div>
                            </div>
                          </>
                        )}
                        {(feature.title === 'Family Communication' || feature.title === 'Mobile Ready' || feature.title === 'Privacy First' || feature.title === 'Personal Event Planner') && (
                          <div className="text-center py-8">
                            <feature.icon className={`h-16 w-16 ${feature.color} mx-auto mb-4 opacity-60`} />
                            <p className="text-gray-500 text-sm">
                              {feature.title === 'Family Communication' && 'Connect and coordinate with family members and other parents'}
                              {feature.title === 'Mobile Ready' && 'Access your schedules on any device, anywhere'}
                              {feature.title === 'Privacy First' && 'Your family\'s data is protected with enterprise-grade security'}
                              {feature.title === 'Personal Event Planner' && 'Beyond sports - manage all your family events in one place'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Additional Features */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Built for Modern Families
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Beyond the basics, FamSink includes advanced features that make family coordination effortless.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {additionalFeatures.map((feature, index) => (
              <div key={index} className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r from-blue-100 to-indigo-200 mb-6">
                  <feature.icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">{feature.description}</p>
                <ul className="space-y-2">
                  {feature.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Integrations */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Supported Platforms
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              FamSink integrates with the most popular youth sports platforms to bring all your schedules together.
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { name: 'TeamSnap', logo: 'https://play-lh.googleusercontent.com/jB40sjFamYP83iQhDcc3DZy_1ukC3TuhH0Dfvh2HMKmhEIFMzB2zTWYZ8CtHU3x5-V8', color: 'border-orange-200' },
              { name: 'SportsEngine', logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQnajmgf8Kri_EZxVAbe7kFESjsiGlQx4lOKw&s', color: 'border-blue-200' },
              { name: 'Playmetrics', logo: 'https://play-lh.googleusercontent.com/3qlMAhClWu_R_XMqFx_8afl4ZiMQpDmw0Xfyb6OyTHAv3--KRr6yxmvmPr0gzQlKJWQ', color: 'border-green-200' },
              { name: 'GameChanger', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/c1/GameChanger_Logo.jpg/250px-GameChanger_Logo.jpg', color: 'border-orange-200' }
            ].map((platform, index) => (
              <div key={index} className={`bg-white rounded-xl p-6 border-2 ${platform.color} hover:shadow-lg transition-all group`}>
                <div className="h-16 w-16 mx-auto mb-4 rounded-lg overflow-hidden">
                  <img 
                    src={platform.logo} 
                    alt={`${platform.name} logo`}
                    className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                  />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 text-center">{platform.name}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to Experience These Features?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of families who have already simplified their sports life with FamSink. Start your free account today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/auth/signup"
              className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-lg text-blue-600 bg-white hover:bg-gray-50 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
            >
              Start Free Today
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
                <li><Link to="/mobileapps" className="hover:text-white transition-colors">Mobile Apps</Link></li>
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

export default Features;