import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageCircle, User, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Event } from '../../types';
import { useCapacitor } from '../../hooks/useCapacitor';

interface EventMessage {
  id: string;
  event_id: string;
  sender_id: string;
  content: string;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const subscriptionRef = useRef<any>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const { isNative } = useCapacitor();

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
          
          // Get sender info
          const { data: senderSettings } = await supabase
            .from('user_settings')
            .select('full_name, profile_photo_url')
            .eq('user_id', newMessage.sender_id)
            .maybeSingle();

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
          
          // Get sender info
          const { data: senderSettings } = await supabase
            .from('user_settings')
            .select('full_name, profile_photo_url')
            .eq('user_id', updatedMessage.sender_id)
            .maybeSingle();

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

      // Get sender info for each message
      const messagesWithSenders = await Promise.all(
        (messagesData || []).map(async (message) => {
          const { data: senderSettings } = await supabase
            .from('user_settings')
            .select('full_name, profile_photo_url')
            .eq('user_id', message.sender_id)
            .maybeSingle();

          return {
            ...message,
            sender: senderSettings
          };
        })
      );

      setMessages(messagesWithSenders);
    } catch (error) {
      console.error('Error loading event messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserId || sending) return;

    setSending(true);
    const messageContent = newMessage.trim();
    
    // Clear input immediately for better UX
    setNewMessage('');

    try {
      const { data: insertedMessage, error } = await supabase
        .from('event_messages')
        .insert({
          event_id: event.id,
          sender_id: currentUserId,
          content: messageContent
        })
        .select()
        .single();

      if (error) throw error;

      console.log('Event message sent successfully:', insertedMessage);

      // Add message optimistically for immediate feedback
      const messageWithSender = {
        ...insertedMessage,
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

    } catch (error) {
      console.error('Error sending event message:', error);
      // Restore input on error
      setNewMessage(messageContent);
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
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
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
        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex space-x-3">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => {
                console.log('Event message input focused - keyboard should appear');
                // Scroll to bottom when input is focused to ensure visibility
                setTimeout(() => forceScrollToBottom(), 100);
              }}
              placeholder="Type a message about this event..."
              className="flex-1 rounded-full border border-gray-300 dark:border-gray-600 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              disabled={sending}
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="bg-blue-600 text-white rounded-full p-2 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
    </div>
  );
};

export default EventMessagesModal;