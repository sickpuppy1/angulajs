angular.module('carApp')
.service('ChatService', [
    '$q', 
    'DatabaseService', 
    function($q, DatabaseService) {
    
    this.getConversation = function(carId, userId, ownerId) {
        return DatabaseService.getAllByIndex('conversations', 'car_id', carId)
            .then(conversations => {
                return conversations.find(conv => 
                    conv.participants.includes(userId) && 
                    conv.participants.includes(ownerId)
                );
            });
    };

    this.createConversation = function(carId, userId, ownerId) {
        const conversation = {
            conversation_id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            participants: [userId, ownerId],
            car_id: carId,
            last_updated: new Date().toISOString(),
            metadata: {
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
        };
        
        return DatabaseService.add('conversations', conversation);
    };

    this.sendMessage = function(messageData) {
        const message = {
            message_id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...messageData,
            timestamp: new Date().toISOString(),
            status: 'sent'
        };

        return DatabaseService.add('messages', message)
            .then(() => this.updateConversation(messageData.conversation_id));
    };

    this.getMessages = function(conversationId) {
        return DatabaseService.getAllByIndex('messages', 'conversation_id', conversationId)
            .then(messages => messages.sort((a, b) => 
                new Date(a.timestamp) - new Date(b.timestamp)
            ));
    };

    this.updateConversation = function(conversationId) {
        return DatabaseService.get('conversations', conversationId)
            .then(conversation => {
                conversation.last_updated = new Date().toISOString();
                conversation.metadata.updated_at = new Date().toISOString();
                return DatabaseService.update('conversations', conversation);
            });
    };
}]);