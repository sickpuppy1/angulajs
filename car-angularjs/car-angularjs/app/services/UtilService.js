/**
 * @description Utility Service
 * Provides common utility functions used across the application
 */
angular.module('carApp')
.service('UtilService', [function() {
    /**
     * @description Generate a UUID v4 (random-based)
     * Creates a standard UUID v4 for unique identifiers
     * @returns {string} UUID string
     */
    this.generateUUID = function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };
}]);
