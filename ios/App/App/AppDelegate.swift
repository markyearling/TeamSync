import UIKit
import Capacitor
import CapacitorPushNotifications
import FirebaseCore
import FirebaseMessaging
import UserNotifications // Import UserNotifications framework

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, MessagingDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // Set UNUserNotificationCenter delegate FIRST (before Firebase)
           UNUserNotificationCenter.current().delegate = self
           print("App Delegate: UNUserNotificationCenter delegate set.")
           
           // Configure Firebase
           FirebaseApp.configure()
           print("App Delegate: Firebase configured.")

           // Set Firebase Messaging delegate
           Messaging.messaging().delegate = self
           print("App Delegate: Firebase Messaging delegate set.")

           // Check current notification settings
           UNUserNotificationCenter.current().getNotificationSettings { settings in
               if settings.authorizationStatus == .notDetermined {
                   // First time - request permission
                   UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
                       print("App Delegate: Permission granted: \(granted)")
                       if let error = error {
                           print("App Delegate: Error requesting notification authorization: \(error.localizedDescription)")
                       }
                       if granted {
                           DispatchQueue.main.async {
                               application.registerForRemoteNotifications()
                               print("App Delegate: Attempting to register for remote notifications.")
                           }
                       }
                   }
               } else if settings.authorizationStatus == .authorized {
                   // Already authorized - just register
                   DispatchQueue.main.async {
                       application.registerForRemoteNotifications()
                       print("App Delegate: Already authorized, registering for remote notifications.")
                   }
               } else {
                   print("App Delegate: Notification authorization denied or not determined.")
               }
           }
           
           return true
    }

    // MARK: - APNs Registration Callbacks

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        print("App Delegate: Successfully registered for remote notifications.")
        
        // 1. Pass device token to Firebase Messaging FIRST
        Messaging.messaging().apnsToken = deviceToken
        print("App Delegate: APNs token passed to Firebase Messaging.")
        
        // 2. Log the APNs token
        let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }
        let token = tokenParts.joined()
        print("App Delegate: APNs Device Token: \(token)")
        
        // 3. Forward to Capacitor
        NotificationCenter.default.post(name:.capacitorDidRegisterForRemoteNotifications, object: deviceToken)
        print("App Delegate: Forwarded APNs token to Capacitor.")
        
        // 4. NOW fetch FCM token (after APNs token is set)
        Messaging.messaging().token { token, error in
            if let error = error {
                print("App Delegate: Error fetching FCM registration token: \(error)")
            } else if let token = token {
                print("App Delegate: FCM registration token: \(token)")
            }
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("App Delegate: Failed to register for remote notifications: \(error.localizedDescription)")
        NotificationCenter.default.post(
          name: .capacitorDidFailToRegisterForRemoteNotifications,
          object: error
        )
    }

    // MARK: - Firebase Messaging Delegate

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        print("App Delegate: Firebase registration token received: \(fcmToken ?? "nil")")
        // This token is the FCM token that should be sent to your app server
        // and saved in your database for sending push notifications.
        // Your JavaScript code in usePushNotifications.ts will pick this up.
        
        
    }

    // MARK: - UNUserNotificationCenter Delegate (for foreground notifications and tap handling)

    // Receive displayed notifications for iOS 10 devices.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        let userInfo = notification.request.content.userInfo
        print("App Delegate: Notification received in foreground: \(userInfo)")

        // Change this to your preferred presentation option
        completionHandler([[.banner, .sound, .badge]])
    }
    // Keep the URL handlers for Capacitor
    func application(_ app: UIApplication, open url: URL,
                     options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
      return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity,
                     restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
      return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    
     // Handle notification messages after user interaction
     func userNotificationCenter(_ center: UNUserNotificationCenter,
     didReceive response: UNNotificationResponse,
     withCompletionHandler completionHandler: @escaping () -> Void) {
     let userInfo = response.notification.request.content.userInfo
     print("App Delegate: Notification tapped: \(userInfo)")
     
     // You can parse userInfo to determine what action to take
     // For example, navigate to a specific screen in your app
     // let type = userInfo["type"] as? String
     // if type == "message" {
     //     // Handle message notification tap
     // }
     
     completionHandler()
     }
     /*
     // MARK: - Capacitor App Delegate Methods
     
     func applicationWillResignActive(_ application: UIApplication) {
     // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
     // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
     }
     
     func applicationDidEnterBackground(_ application: UIApplication) {
     // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
     // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
     }
     
     func applicationWillEnterForeground(_ application: UIApplication) {
     // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
     }
     
     func applicationDidBecomeActive(_ application: UIApplication) {
     // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
     }
     
     func applicationWillTerminate(_ application: UIApplication) {
     // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
     }
     
     func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
     // Called when the app was launched with a url. Feel free to add additional processing here,
     // but if you want the App API to support tracking app url opens, make sure to keep this call
     return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
     }
     
     func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
     // Called when the app was launched with an activity, including Universal Links.
     // Feel free to add additional processing here, but if you want the App API to support
     // tracking app url opens, make sure to keep this call
     return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
     }
     */
     }
     
