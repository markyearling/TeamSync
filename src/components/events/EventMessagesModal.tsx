import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageCircle, User, Loader2, Camera, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Event } from '../../types';
import { useCapacitor } from '../../hooks/useCapacitor';
import { useCamera } from '../../hooks/useCamera';
import { Keyboard } from '@capacitor/keyboard';
import { uploadEventMessageImage, uploadEventMessageImageFromFile, deleteEventMessageImage } from '../../utils/imageUpload';

interface EventMessage {
  id: string;
  event_id: string;
  sender_id: string;
  content: string;
  image_url?: string | null;
  has_image?: boolean;
  created_at: string;
  updated_at: string;
  sender?: {
    full_name?: string;
    profile_photo_url?: string;
  };
}

interface EventMessagesModalProps {
  event: Event;
  onClose: () => void;
}

const EventMessagesModal: React.FC<EventMessagesModalProps> = ({ event, onClose }) => {
  const [messages, setMessages] = useState<EventMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserInfo, setCurrentUserInfo] = useState<any>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subscriptionRef = useRef<any>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const sendersCache = useRef<Map<string, any>>(new Map());
  const { isNative } = useCapacitor();
  const { takePhoto, selectFromGallery } = useCamera();

  // Helper function to make URLs clickable
  const linkifyText = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 underline"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Helper function to fetch sender info (with caching)
  const getSenderInfo = async (senderId: string) => {
    if (sendersCache.current.has(senderId)) {
      return sendersCache.current.get(senderId);
    }

    const { data: senderSettings } = await supabase
      .from('user_settings')
      .select('full_name, profile_photo_url')
      .eq('user_id', senderId)
      .maybeSingle();

    sendersCache.current.set(senderId, senderSettings);
    return senderSettings;
  };

  // Auto-scroll to bottom function
  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'auto') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Force scroll to bottom (for initial load and new messages)
  const forceScrollToBottom = () => {
    setTimeout(() => {
      scrollToBottom('auto');
    }, 50);
  };

  // Determine if we should use full-screen modal on mobile
  const containerClasses = isNative
    ? "fixed inset-0 z-[999] bg-white dark:bg-gray-800"
    : "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[999] p-4";

  const modalContentClasses = isNative
    ? "flex flex-col h-full w-full overflow-hidden"
    : "bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl h-full max-h-[90vh] overflow-hidden flex flex-col";

  // Handle keyboard height adjustments for mobile
  useEffect(() => {
    if (!isNative) return;

    const keyboardWillShowListener = Keyboard.addListener('keyboardWillShow', (info) => {
      console.log('Keyboard will show, height:', info.keyboardHeight);
      setKeyboardHeight(info.keyboardHeight);
    });

    const keyboardWillHideListener = Keyboard.addListener('keyboardWillHide', () => {
      console.log('Keyboard will hide');
      setKeyboardHeight(0);
    });

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, [isNative]);

  useEffect(() => {
    initializeMessages();
    
    // Focus input when modal opens
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    // Handle clicks outside the modal
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (!isNative) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      if (!isNative) {
        document.removeEventListener('mousedown', handleClickOutside);
      }
      // Clean up subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [event.id, onClose, isNative]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      forceScrollToBottom();
    }
  }, [messages]);

  // Scroll to bottom when modal first opens and messages are loaded
  useEffect(() => {
    if (!loading && messages.length > 0) {
      forceScrollToBottom();
    }
  }, [loading]);

  useEffect(() => {
    if (!currentUserId) return;

    // Clean up previous subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    console.log('Setting up real-time subscription for event messages:', event.id);

    // Set up real-time subscription for messages in this event
    subscriptionRef.current = supabase
      .channel(`event-messages:event_id=eq.${event.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_messages',
          filter: `event_id=eq.${event.id}`
        },
        async (payload) => {
          console.log('New event message received via realtime:', payload);
          const newMessage = payload.new as EventMessage;

          // Get sender info using cached helper
          const senderSettings = await getSenderInfo(newMessage.sender_id);

          const messageWithSender = {
            ...newMessage,
            sender: senderSettings
          };

          setMessages(prev => {
            // Check if message already exists to prevent duplicates
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) {
              console.log('Message already exists, skipping duplicate');
              return prev;
            }
            
            console.log('Adding new event message to state');
            const newMessages = [...prev, messageWithSender];
            
            // Auto-scroll to bottom when new message arrives
            setTimeout(() => forceScrollToBottom(), 50);
            
            return newMessages;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'event_messages',
          filter: `event_id=eq.${event.id}`
        },
        async (payload) => {
          console.log('Event message updated via realtime:', payload);
          const updatedMessage = payload.new as EventMessage;

          // Get sender info using cached helper
          const senderSettings = await getSenderInfo(updatedMessage.sender_id);

          const messageWithSender = {
            ...updatedMessage,
            sender: senderSettings
          };

          setMessages(prev => 
            prev.map(msg => 
              msg.id === updatedMessage.id ? messageWithSender : msg
            )
          );
        }
      )
      .subscribe((status) => {
        console.log('Event messages subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time event messages for event:', event.id);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Error subscribing to real-time event messages');
        }
      });

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [event.id, currentUserId]);

  const initializeMessages = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) return;

      setCurrentUserId(user.id);

      // Get current user info
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('full_name, profile_photo_url')
        .eq('user_id', user.id)
        .maybeSingle();

      setCurrentUserInfo(userSettings);

      // Load messages for this event
      await loadMessages();
    } catch (error) {
      console.error('Error initializing event messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const { data: messagesData, error } = await supabase
        .from('event_messages')
        .select('*')
        .eq('event_id', event.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!messagesData || messagesData.length === 0) {
        setMessages([]);
        return;
      }

      // Get unique sender IDs
      const senderIds = [...new Set(messagesData.map(m => m.sender_id))];

      // Batch fetch sender info for all unique senders
      const { data: sendersData } = await supabase
        .from('user_settings')
        .select('user_id, full_name, profile_photo_url')
        .in('user_id', senderIds);

      // Create a map for quick lookup
      const sendersMap = new Map(
        sendersData?.map(s => [s.user_id, s]) || []
      );

      // Attach sender info to messages
      const messagesWithSenders = messagesData.map(message => ({
        ...message,
        sender: sendersMap.get(message.sender_id)
      }));

      setMessages(messagesWithSenders);
    } catch (error) {
      console.error('Error loading event messages:', error);
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !selectedImage) || !currentUserId || sending) return;

    setSending(true);
    const messageContent = newMessage.trim() || ' ';
    const imageToUpload = selectedImage;

    // Clear input immediately for better UX
    setNewMessage('');
    setSelectedImage(null);

    try {
      let imageUrl: string | null = null;

      // First insert the message to get the message ID
      const { data: insertedMessage, error: insertError } = await supabase
        .from('event_messages')
        .insert({
          event_id: event.id,
          sender_id: currentUserId,
          content: messageContent,
          has_image: !!imageToUpload,
          image_url: null
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Upload image if there is one
      if (imageToUpload && insertedMessage) {
        const uploadResult = await uploadEventMessageImage(
          imageToUpload,
          event.id.toString(),
          insertedMessage.id
        );

        if (uploadResult.url) {
          imageUrl = uploadResult.url;

          // Update message with image URL
          const { error: updateError } = await supabase
            .from('event_messages')
            .update({ image_url: imageUrl })
            .eq('id', insertedMessage.id);

          if (updateError) {
            console.error('Error updating message with image URL:', updateError);
          }
        } else {
          console.error('Error uploading image:', uploadResult.error);
        }
      }

      console.log('Event message sent successfully:', insertedMessage);

      // Add message optimistically for immediate feedback (before notifications)
      const messageWithSender = {
        ...insertedMessage,
        image_url: imageUrl,
        sender: currentUserInfo
      };

      setMessages(prev => {
        // Check if message already exists (from real-time subscription)
        const exists = prev.some(msg => msg.id === insertedMessage.id);
        if (exists) {
          return prev;
        }
        const newMessages = [...prev, messageWithSender];

        // Auto-scroll to bottom when sending message
        setTimeout(() => forceScrollToBottom(), 50);

        return newMessages;
      });

      // Send notification asynchronously in the background (non-blocking)
      (async () => {
        try {
          const notificationResponse = await supabase.functions.invoke('create-event-message-notification', {
            body: {
              message_id: insertedMessage.id,
              event_id: event.id.toString(),
              sender_id: currentUserId,
              content: messageContent,
              image_url: imageUrl
            }
          });

          if (notificationResponse.error) {
            console.error('Error sending event message notifications (background):', notificationResponse.error);
          } else {
            console.log('Event message notifications sent (background):', notificationResponse.data);
          }
        } catch (notifError) {
          console.error('Exception sending event message notifications (background):', notifError);
        }
      })();

    } catch (error) {
      console.error('Error sending event message:', error);
      // Restore input on error
      setNewMessage(messageContent);
      setSelectedImage(imageToUpload);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleImageSelect = async () => {
    if (!isNative) {
      fileInputRef.current?.click();
      return;
    }
    setShowImageOptions(true);
  };

  const handleTakePhoto = async () => {
    const photoDataUrl = await takePhoto();
    if (photoDataUrl) {
      setSelectedImage(photoDataUrl);
    }
    setShowImageOptions(false);
  };

  const handleSelectFromGallery = async () => {
    const photoDataUrl = await selectFromGallery();
    if (photoDataUrl) {
      setSelectedImage(photoDataUrl);
    }
    setShowImageOptions(false);
  };

  const handleWebFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
  };

  return (
    <div 
      className={containerClasses}
      style={isNative ? {
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)'
      } : {}}
    >
      <div 
        ref={modalRef}
        className={modalContentClasses}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900">
                <MessageCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Event Messages
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {event.title}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
          style={{ scrollBehavior: 'auto' }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : messages.length > 0 ? (
            messages.map((message, index) => {
              const isCurrentUser = message.sender_id === currentUserId;
              const showAvatar = !isCurrentUser && (
                index === 0 || 
                messages[index - 1].sender_id !== message.sender_id ||
                new Date(message.created_at).getTime() - new Date(messages[index - 1].created_at).getTime() > 5 * 60 * 1000
              );

              return (
                <div
                  key={message.id}
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} ${
                    showAvatar ? 'mt-4' : 'mt-1'
                  }`}
                >
                  {!isCurrentUser && showAvatar && (
                    <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-500 flex items-center justify-center mr-2 flex-shrink-0">
                      {message.sender?.profile_photo_url ? (
                        <img 
                          src={message.sender.profile_photo_url} 
                          alt="" 
                          className="w-8 h-8 rounded-full object-cover" 
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                          {(message.sender?.full_name || 'U').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  )}
                  {!isCurrentUser && !showAvatar && (
                    <div className="w-8 mr-2 flex-shrink-0"></div>
                  )}
                  
                  <div className={`max-w-xs lg:max-w-md ${isCurrentUser ? 'order-1' : 'order-2'}`}>
                    {!isCurrentUser && showAvatar && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {message.sender?.full_name || 'Unknown User'}
                      </div>
                    )}
                    <div
                      className={`px-4 py-2 rounded-lg ${
                        isCurrentUser
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                      }`}
                    >
                      {message.image_url && (
                        <div className="mb-2">
                          <img
                            src={message.image_url}
                            alt="Shared image"
                            className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setViewingImage(message.image_url!)}
                            style={{ maxHeight: '300px', objectFit: 'contain' }}
                          />
                        </div>
                      )}
                      {message.content.trim() !== ' ' && (
                        <p className="text-sm whitespace-pre-wrap break-words">{linkifyText(message.content)}</p>
                      )}
                    </div>
                    <div className={`mt-1 text-xs text-gray-500 dark:text-gray-400 ${
                      isCurrentUser ? 'text-right' : 'text-left'
                    }`}>
                      {formatTime(message.created_at)}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No messages yet</p>
              <p className="text-sm">Be the first to comment on this event</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div
          className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0"
          style={isNative && keyboardHeight > 0 ? { paddingBottom: `${keyboardHeight}px` } : {}}
        >
          {/* Image Preview */}
          {selectedImage && (
            <div className="mb-3 relative inline-block">
              <img
                src={selectedImage}
                alt="Selected"
                className="max-h-32 rounded-lg"
              />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex items-end space-x-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleWebFileSelect}
            />
            <button
              onClick={handleImageSelect}
              disabled={sending || uploadingImage}
              className="flex-shrink-0 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Add image"
            >
              <Camera className="h-5 w-5" />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => {
                console.log('Event message input focused - keyboard should appear');
                setTimeout(() => forceScrollToBottom(), 300);
              }}
              placeholder="Type a message about this event..."
              className="flex-1 rounded-full border border-gray-300 dark:border-gray-600 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              disabled={sending}
            />
            <button
              onClick={sendMessage}
              disabled={(!newMessage.trim() && !selectedImage) || sending}
              className="flex-shrink-0 bg-blue-600 text-white rounded-full p-2 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Image Viewing Lightbox */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-[1000] bg-black bg-opacity-90 flex items-center justify-center"
          style={{
            paddingTop: isNative ? 'env(safe-area-inset-top)' : '1rem',
            paddingBottom: isNative ? 'env(safe-area-inset-bottom)' : '1rem',
            paddingLeft: isNative ? 'env(safe-area-inset-left)' : '1rem',
            paddingRight: isNative ? 'env(safe-area-inset-right)' : '1rem',
          }}
          onClick={() => setViewingImage(null)}
        >
          <button
            onClick={() => setViewingImage(null)}
            className="absolute text-white hover:text-gray-300 z-10 bg-black bg-opacity-50 rounded-full p-2"
            style={{
              top: isNative ? 'calc(env(safe-area-inset-top) + 1rem)' : '1rem',
              right: isNative ? 'calc(env(safe-area-inset-right) + 1rem)' : '1rem',
            }}
          >
            <X className="h-8 w-8" />
          </button>
          <img
            src={viewingImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Mobile Image Options Modal */}
      {showImageOptions && isNative && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-[1000]">
          <div className="bg-white dark:bg-gray-800 rounded-t-lg w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white text-center">
              Add Image
            </h3>

            <div className="space-y-3">
              <button
                onClick={handleTakePhoto}
                className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Camera className="h-5 w-5 mr-2" />
                Take Photo
              </button>

              <button
                onClick={handleSelectFromGallery}
                className="w-full flex items-center justify-center px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <ImageIcon className="h-5 w-5 mr-2" />
                Choose from Gallery
              </button>

              <button
                onClick={() => setShowImageOptions(false)}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventMessagesModal;