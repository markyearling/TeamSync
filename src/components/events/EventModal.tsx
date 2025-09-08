import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageCircle, User, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCapacitor } from '../../hooks/useCapacitor';
import { Event } from '../../types';
import { DateTime } from 'luxon';
import { useAuth } from '../../hooks/useAuth';

interface Message {
  id: string;
  event_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    full_name?: string;
    profile_photo_url?: string;
  };
}

interface EventMessagesModalProps {
  event: Event;
  onClose: () => void;
  userTimezone?: string;
}

const EventMessagesModal: React.FC<EventMessagesModalProps> = ({ event, onClose, userTimezone = 'UTC' }) => {
  const { user: authUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const modalContentClasses = isNative
    ? "flex flex-col h-full w-full overflow-hidden bg-white dark:bg-gray-800"
    : "bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl h-full max-h-full overflow-hidden flex flex-col";

  useEffect(() => {
    initializeMessages();
    
    
    // Close emoticon picker when clicking outside (only for web)
    const handleEmoticonClickOutside = (event: MouseEvent) => {
      if (!isNative && emoticonRef.current && !emoticonRef.current.contains(event.target as Node)) {
        setShowEmoticons(false);
      }
    };

    document.addEventListener('mousedown', handleEmoticonClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleEmoticonClickOutside);
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
    if (!event.id) return;

    // Clean up previous subscription
    if (subscriptionRef.current) {
      try { subscriptionRef.current.unsubscribe(); } catch (err) { /* ignore */ }
      subscriptionRef.current = null;
    }

    console.log('Setting up real-time subscription for event messages:', event.id);

    // Set up real-time subscription for messages in this event
    subscriptionRef.current = supabase
      .channel(`event_messages:event_id=eq.${event.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_messages',
          filter: `event_id=eq.${event.id}` // <-- fixed: proper template literal (no stray backslash)
        },
        async (payload) => {
          console.log('New event message received via realtime:', payload);
          const incomingMsg = payload.new as Message; // <-- renamed to avoid shadowing the input state
          
          // Get sender info
          const { data: senderSettings } = await supabase
            .from('user_settings')
            .select('full_name, profile_photo_url')
            .eq('user_id', incomingMsg.sender_id)
            .maybeSingle();

          const messageWithSender = {
            ...incomingMsg,
            created_at: incomingMsg.created_at,
            sender: senderSettings
          };

          setMessages(prev => {
            const exists = prev.some(msg => msg.id === incomingMsg.id);
            if (exists) return prev;

            const newMessages = [...prev, messageWithSender];
            setTimeout(() => forceScrollToBottom(), 50);
            return newMessages;
          });
        }
      )
      .subscribe((status) => {
        console.log('Event messages chat subscription status:', status);
      });

    return () => {
      try {
        subscriptionRef.current?.unsubscribe();
      } catch (err) {
        console.warn('Error unsubscribing', err);
      }
      subscriptionRef.current = null;
    };
  }, [event.id]);

  const initializeMessages = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: messagesData, error: fetchError } = await supabase
        .from('event_messages')
        .select('*')
        .eq('event_id', event.id)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

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
    } catch (err) {
      console.error('Error initializing event messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !authUser || sending) return;

    setSending(true);
    const messageContent = newMessage.trim();
    
    // Clear input immediately for better UX
    setNewMessage('');

    try {
      const { data: insertedMessage, error: insertError } = await supabase
        .from('event_messages')
        .insert({
          event_id: event.id,
          sender_id: authUser.id,
          content: messageContent
        })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log('Event message sent successfully:', insertedMessage);

      // Add message optimistically for immediate feedback
      const messageWithSender = {
        ...insertedMessage,
        sender: {
          full_name: authUser.user_metadata.full_name || authUser.email,
          profile_photo_url: authUser.user_metadata.profile_photo_url
        }
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

    } catch (err) {
      console.error('Error sending event message:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during sending');
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
    const date = DateTime.fromISO(dateString).setZone(userTimezone);
    const now = DateTime.now().setZone(userTimezone);

    if (date.hasSame(now, 'day')) {
      return date.toLocaleString(DateTime.TIME_SIMPLE);
    } else if (date.hasSame(now.minus({ days: 1 }), 'day')) {
      return `Yesterday ${date.toLocaleString(DateTime.TIME_SIMPLE)}`;
    } else if (date.hasSame(now, 'week')) {
      return date.toLocaleString({ weekday: 'short', hour: 'numeric', minute: '2-digit' });
    } else {
      return date.toLocaleString(DateTime.DATETIME_SHORT);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[999] ${isNative ? '' : 'bg-black bg-opacity-50 flex items-center justify-center p-4 sm:p-6'}`}
      onClick={isNative ? undefined : onClose} // Close modal on overlay click for web
    >
      <div 
        ref={modalRef}
        className={`
          ${isNative 
            ? 'flex flex-col h-full w-full overflow-hidden bg-white dark:bg-gray-800 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]'
            : 'bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl h-full max-h-full overflow-hidden flex flex-col'
          }
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <MessageCircle className="h-6 w-6 text-blue-600 mr-2" />
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Event Messages
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
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
              <Loader2 className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-red-600 dark:text-red-400">
              <AlertCircle className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">Error loading messages</p>
              <p className="text-sm text-center">{error}</p>
            </div>
          ) : messages.length > 0 ? (
            messages.map((message, index) => {
              const isCurrentUser = authUser && message.sender_id === authUser.id;
              const showAvatar = !isCurrentUser && (
                index === 0 || 
                messages[index - 1].sender_id !== message.sender_id ||
                DateTime.fromISO(message.created_at).diff(DateTime.fromISO(messages[index - 1].created_at), 'minutes').minutes > 5
              );

              return (
                <div
                  key={message.id}
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} ${
                    showAvatar ? 'mt-4' : 'mt-1'
                  }`}
                >
                  {!isCurrentUser && showAvatar && (
                    <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-500 flex items-center justify-center mr-2 flex-shrink-0 overflow-hidden">
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
              <p className="text-sm">Be the first to send a message about this event!</p>
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
                // Scroll to bottom when input is focused to ensure visibility
                setTimeout(() => forceScrollToBottom(), 100);
              }}
              placeholder="Type a message..."
              className="flex-1 rounded-full border border-gray-300 dark:border-gray-600 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              disabled={sending || !authUser}
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending || !authUser}
              className="bg-blue-600 text-white rounded-full p-2 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? (
                <Loader2 className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
          {!authUser && (
            <p className="text-center text-sm text-red-500 dark:text-red-400 mt-2">
              You must be logged in to send messages.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventMessagesModal;