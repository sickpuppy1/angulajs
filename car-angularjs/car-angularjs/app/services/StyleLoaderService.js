/**
 * @description StyleLoaderService
 * Provides functionality to lazy load CSS files as needed
 * Handles caching and prevents duplicate stylesheet loading
 */
angular.module('carApp')
.service('StyleLoaderService', ['$document', '$q', function($document, $q) {
    // Track loaded stylesheets to prevent duplication
    const loadedStylesheets = new Set();
    
    /**
     * @description Load a CSS file dynamically
     * @param {string} href - Path to the CSS file
     * @param {boolean} forceReload - Force reload even if already loaded
     * @returns {Promise} - Resolves when CSS is loaded
     */
    this.loadStylesheet = function(href, forceReload = false) {
        return $q(function(resolve, reject) {
            // Check if already loaded and not forcing reload
            if (loadedStylesheets.has(href) && !forceReload) {
                resolve(href);
                return;
            }
            
            // Check if this stylesheet is already loaded in the DOM
            const existingLinks = $document[0].querySelectorAll('link[rel="stylesheet"]');
            for (let i = 0; i < existingLinks.length; i++) {
                if (existingLinks[i].getAttribute('href') === href) {
                    loadedStylesheets.add(href);
                    resolve(href);
                    return;
                }
            }
            
            // Create new link element
            const link = $document[0].createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            
            // Set up load and error handlers
            link.onload = function() {
                loadedStylesheets.add(href);
                resolve(href);
            };
            
            link.onerror = function() {
                reject(new Error(`Failed to load stylesheet: ${href}`));
            };
            
            // Add link to document head
            $document[0].head.appendChild(link);
        });
    };
}]);