// Update MessageService
angular.module('carApp')
.service('MessageService', ['$q', 'DatabaseService', function($q, DatabaseService) {
    
    // Get conversations for a user
    this.getConversations = function(userId) {
        if (!userId) {
            return $q.reject('User ID is required');
        }
        
        console.log('Getting conversations for user:', userId);
        
        // For debugging, first get all conversations
        return DatabaseService.getAll('conversations')
            .then(function(allConversations) {
                console.log('All conversations in DB:', allConversations);
                
                // Manually filter for this user's conversations
                const userConversations = allConversations.filter(function(conv) {
                    return Array.isArray(conv.participants) && 
                           conv.participants.includes(userId);
                });
                
                console.log('User conversations after manual filtering:', userConversations);
                
                // Now proceed with enhancing these conversations
                const promises = userConversations.map(function(conversation) {
                    return DatabaseService.query('messages', 'conversation_id', conversation.conversation_id)
                        .then(function(messages) {
                            // Get last message and unread count
                            let lastMessage = null;
                            let unreadCount = 0;
                            
                            if (messages && messages.length > 0) {
                                // Sort by timestamp descending
                                messages.sort(function(a, b) {
                                    return new Date(b.timestamp) - new Date(a.timestamp);
                                });
                                
                                lastMessage = messages[0];
                                
                                // Count unread messages
                                unreadCount = messages.filter(function(msg) {
                                    return !msg.read && msg.receiver_id === userId;
                                }).length;
                            }
                            
                            return {
                                ...conversation,
                                lastMessage: lastMessage || { content: 'No messages yet' },
                                unreadCount: unreadCount
                            };
                        });
                });
                
                return $q.all(promises);
            })
            .then(function(enhancedConversations) {
                // Sort by most recent message
                enhancedConversations.sort(function(a, b) {
                    const aTime = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp) : new Date(0);
                    const bTime = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp) : new Date(0);
                    return bTime - aTime;
                });
                
                console.log('Enhanced conversations:', enhancedConversations);
                return enhancedConversations;
            });
    };
    // Add this method to the existing MessageService
this.findOrCreateConversation = function(options) {
    if (!options || !Array.isArray(options.participants) || options.participants.length < 2) {
        return $q.reject('Invalid conversation options');
    }
    
    const user1Id = options.participants[0];
    const user2Id = options.participants[1];
    const carId = options.car_id;
    
    console.log('Finding or creating conversation for users:', user1Id, user2Id, 'and car:', carId);
    
    // First, check if a conversation exists for these participants and car
    return DatabaseService.getAll('conversations')
        .then(function(conversations) {
            // Find matching conversation
            const existingConversation = conversations.find(function(convo) {
                // Match both participants and car ID if provided
                const hasParticipants = Array.isArray(convo.participants) && 
                    convo.participants.includes(user1Id) && 
                    convo.participants.includes(user2Id);
                
                // If carId is provided, match it too; otherwise just match participants
                return hasParticipants && (!carId || convo.car_id === carId);
            });
            
            if (existingConversation) {
                console.log('Found existing conversation:', existingConversation.conversation_id);
                return existingConversation;
            }
            
            // No matching conversation found, create new one
            console.log('Creating new conversation for users');
            const newConversation = {
                conversation_id: 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
                participants: options.participants,
                car_id: carId || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            return DatabaseService.add('conversations', newConversation)
                .then(function() {
                    return newConversation;
                });
        });
};
    // Get messages by conversation ID
    this.getMessagesByConversationId = function(conversationId) {
        if (!conversationId) {
            return $q.reject('Conversation ID is required');
        }
        
        console.log('Fetching messages for conversation:', conversationId);
        
        // Use the query method with the conversation_id index
        return DatabaseService.getAllByIndex('messages', 'conversation_id', conversationId)
            .then(function(messages) {
                console.log('Retrieved messages:', messages);
                
                if (!messages || !Array.isArray(messages)) {
                    console.warn('No messages found for conversation:', conversationId);
                    return [];
                }
                
                // Sort by timestamp ascending (oldest first)
                messages.sort(function(a, b) {
                    return new Date(a.timestamp) - new Date(b.timestamp);
                });
                
                return messages;
            })
            .catch(function(error) {
                console.error('Error fetching messages for conversation:', conversationId, error);
                return $q.reject(error);
            });
    };
    
    // Send a message
    this.sendMessage = function(message) {
        if (!message || !message.conversation_id || !message.sender_id) {
            return $q.reject('Invalid message data');
        }
        
        const newMessage = {
            message_id: 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            conversation_id: message.conversation_id,
            sender_id: message.sender_id,
            receiver_id: message.receiver_id,
            content: message.content || '',
            type: message.type || 'text',
            imageUrl: message.imageUrl || null,
            bidData: message.bidData || null,
            timestamp: new Date().toISOString(),
            read: false
        };
        
        return DatabaseService.add('messages', newMessage)
            .then(function() {
                // Update conversation's updated_at timestamp
                return DatabaseService.get('conversations', message.conversation_id);
            })
            .then(function(conversation) {
                if (conversation) {
                    conversation.updated_at = new Date().toISOString();
                    return DatabaseService.update('conversations', conversation);
                }
                return null;
            })
            .then(function() {
                return newMessage;
            });
    };
    
    // Get conversation by ID
    this.getConversationById = function(conversationId) {
        if (!conversationId) {
            return $q.reject('Conversation ID is required');
        }
        
        return DatabaseService.get('conversations', conversationId);
    };
    
    // Create new conversation
    this.createConversation = function(conversation) {
        if (!conversation || !Array.isArray(conversation.participants) || conversation.participants.length < 2) {
            return $q.reject('Invalid conversation data');
        }
        
        const newConversation = {
            conversation_id: 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
            participants: conversation.participants,
            car_id: conversation.car_id || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        return DatabaseService.add('conversations', newConversation);
    };
    
    // Mark messages as read
    this.markAsRead = function(messages) {
        if (!Array.isArray(messages) || messages.length === 0) {
            return $q.resolve();
        }
        
        const promises = messages.map(function(message) {
            message.read = true;
            return DatabaseService.update('messages', message);
        });
        
        return $q.all(promises);
    };
    
    // Update bid status
    this.updateBidStatus = function(messageId, status) {
        return DatabaseService.get('messages', messageId)
            .then(function(message) {
                if (!message) {
                    return $q.reject('Message not found');
                }
                
                if (!message.bidData) {
                    message.bidData = {};
                }
                
                message.bidData.status = status;
                
                return DatabaseService.update('messages', message);
            });
    };
}]);