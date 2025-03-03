angular.module('carApp')
.service('DatabaseService', ['$q', function($q) {
    const DB_NAME = 'CarRental';
    const DB_VERSION = 16;
    let db;
    const dbReady = initializeDatabase();

    // Initialize database
    function initializeDatabase() {
        return $q((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                db = event.target.result;
                
                // Create object stores with their indices
                createBookingsStore(db);
                createCarsStore(db);
                createUsersStore(db);
                createMessagesStore(db);
                createReviewsStore(db);
                createConversationsStore(db);

                console.log('Database schema updated to version', event.newVersion);
            };

            request.onsuccess = () => {
                db = request.result;
                console.log('Database opened successfully');
                resolve(db);
            };

            request.onerror = () => {
                console.error('Database error:', request.error);
                reject(request.error);
            };
        });
    }

    function createBookingsStore(db) {
        if (db.objectStoreNames.contains('bookings')) {
            db.deleteObjectStore('bookings');
        }

        const bookingStore = db.createObjectStore('bookings', { keyPath: 'id' });

        // Basic indices
        bookingStore.createIndex('car_id', 'car_id');
        bookingStore.createIndex('user_id', 'user_id');
        bookingStore.createIndex('owner_id', 'owner_id');
        bookingStore.createIndex('status', 'status');
        bookingStore.createIndex('payment_status', 'payment_status');

        // Date indices
        bookingStore.createIndex('start_date', 'start_date');
        bookingStore.createIndex('end_date', 'end_date');
        bookingStore.createIndex('created_at', 'metadata.created_at');
        bookingStore.createIndex('updated_at', 'metadata.updated_at');

        // Compound indices
        bookingStore.createIndex('car_dates', ['car_id', 'start_date', 'end_date']);
        bookingStore.createIndex('user_dates', ['user_id', 'start_date', 'end_date']);
        bookingStore.createIndex('owner_status', ['owner_id', 'status']);

        // Amount indices
        bookingStore.createIndex('bid_amount', 'bid_amount');
        bookingStore.createIndex('total_amount', 'total_amount');

        // Denormalized indices
        createDenormalizedCarIndices(bookingStore);
        createDenormalizedUserIndices(bookingStore);
        createMetadataIndices(bookingStore);
    }
    function createDenormalizedOwnerIndices(store) {
        store.createIndex('owner.user_id', 'owner.user_id');
        store.createIndex('owner.name', 'owner.name');
        store.createIndex('owner.email', 'owner.email');
        store.createIndex('owner.role', 'owner.role');
    }

    function createCarsStore(db) {
        if (db.objectStoreNames.contains('cars')) {
            db.deleteObjectStore('cars');
        }

        const carStore = db.createObjectStore('cars', { keyPath: 'car_id' });
        
        // Basic indices
        carStore.createIndex('owner_id', 'owner_id');
        carStore.createIndex('make', 'make');
        carStore.createIndex('model', 'model');
        carStore.createIndex('year', 'year');
        carStore.createIndex('location', 'location');
        carStore.createIndex('price_per_day', 'price_per_day');
        carStore.createIndex('status', 'status');
        
        // Denormalized owner indices
        createDenormalizedOwnerIndices(carStore);
        createMetadataIndices(carStore);
    }

    function createUsersStore(db) {
        if (db.objectStoreNames.contains('users')) {
            db.deleteObjectStore('users');
        }

        const userStore = db.createObjectStore('users', { keyPath: 'user_id' });
        userStore.createIndex('email', 'email', { unique: true });
        userStore.createIndex('role', 'role');
        userStore.createIndex('created_at', 'created_at');
    }

    function createMessagesStore(db) {
        if (db.objectStoreNames.contains('messages')) {
            db.deleteObjectStore('messages');
        }

        const messageStore = db.createObjectStore('messages', { keyPath: 'message_id', autoIncrement: true });
        messageStore.createIndex('sender_id', 'sender_id');
        messageStore.createIndex('receiver_id', 'receiver_id');
        messageStore.createIndex('car_id', 'car_id');
        messageStore.createIndex('conversation_id', 'conversation_id');
        messageStore.createIndex('created_at', 'created_at');
    }

    function createReviewsStore(db) {
        if (db.objectStoreNames.contains('reviews')) {
            db.deleteObjectStore('reviews');
        }

        const reviewStore = db.createObjectStore('reviews', { keyPath: 'review_id' });
        reviewStore.createIndex('car_id', 'car_id');
        reviewStore.createIndex('user_id', 'user_id');
        reviewStore.createIndex('rating', 'rating');
        reviewStore.createIndex('created_at', 'created_at');
    }

    function createConversationsStore(db) {
        if (db.objectStoreNames.contains('conversations')) {
            db.deleteObjectStore('conversations');
        }

        const conversationStore = db.createObjectStore('conversations', { keyPath: 'conversation_id' });
        conversationStore.createIndex('participants', 'participants', { multiEntry: true });
        conversationStore.createIndex('car_id', 'car_id');
        conversationStore.createIndex('last_updated', 'last_updated');
        createMetadataIndices(conversationStore);
    }

    // Helper functions for creating indices
    function createDenormalizedCarIndices(store) {
        store.createIndex('car.car_id', 'car.car_id');
        store.createIndex('car.make', 'car.make');
        store.createIndex('car.model', 'car.model');
        store.createIndex('car.year', 'car.year');
        store.createIndex('car.location', 'car.location');
        store.createIndex('car.price_per_day', 'car.price_per_day');
        store.createIndex('car.owner_id', 'car.owner_id');
    }

    function createDenormalizedUserIndices(store) {
        store.createIndex('user.user_id', 'user.user_id');
        store.createIndex('user.name', 'user.name');
        store.createIndex('user.email', 'user.email');
        store.createIndex('user.role', 'user.role');
    }

    function createMetadataIndices(store) {
        store.createIndex('metadata.created_at', 'metadata.created_at');
        store.createIndex('metadata.updated_at', 'metadata.updated_at');
        store.createIndex('metadata.status_history', 'metadata.status_history', { multiEntry: true });
    }

    // Public API
    this.ready = () => dbReady;
    this.getDb = () => db;

    // Generic CRUD operations
    this.add = function(storeName, data) {
        return dbReady.then(() => {
            return $q((resolve, reject) => {
                const transaction = db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.add(data);
                
                request.onsuccess = () => resolve(data);
                request.onerror = () => reject(request.error);
            });
        });
    };

    this.get = function(storeName, key) {
        return dbReady.then(() => {
            return $q((resolve, reject) => {
                const transaction = db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(key);
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        });
    };

    this.getAll = function(storeName) {
        return dbReady.then(() => {
            return $q((resolve, reject) => {
                const transaction = db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAll();
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        });
    };

    this.update = function(storeName, data) {
        return dbReady.then(() => {
            return $q((resolve, reject) => {
                const transaction = db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.put(data);
                
                request.onsuccess = () => resolve(data);
                request.onerror = () => reject(request.error);
            });
        });
    };

    this.delete = function(storeName, key) {
        return dbReady.then(() => {
            return $q((resolve, reject) => {
                const transaction = db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.delete(key);
                
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        });
    };

    // Index-based queries
    this.getByIndex = function(storeName, indexName, key) {
        return dbReady.then(() => {
            return $q((resolve, reject) => {
                const transaction = db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const index = store.index(indexName);
                const request = index.get(key);
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        });
    };

    this.getAllByIndex = function(storeName, indexName, key) {
        return dbReady.then(() => {
            return $q((resolve, reject) => {
                const transaction = db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const index = store.index(indexName);
                const request = index.getAll(key);
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        });
    };

    // Make sure this method exists in your DatabaseService
// Make sure this method is properly implemented in DatabaseService
this.query = function(storeName, indexName, value) {
    return dbReady.then(function() {
        return $q(function(resolve, reject) {
            try {
                console.log(`Querying ${storeName} with index ${indexName} for value:`, value);
                
                const transaction = db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                
                // Make sure the index exists
                if (!store.indexNames.contains(indexName)) {
                    console.error(`Index ${indexName} not found in store ${storeName}`);
                    console.log('Available indexes:', Array.from(store.indexNames));
                    reject(`Index ${indexName} not found in store ${storeName}`);
                    return;
                }
                
                const index = store.index(indexName);
                let request;
                
                // Use getAll for consistent results
                request = index.getAll(value);
                
                request.onsuccess = function() {
                    console.log(`Query results for ${storeName}.${indexName}(${value}):`, request.result);
                    resolve(request.result);
                };
                
                request.onerror = function(event) {
                    console.error(`Query error for ${storeName}.${indexName}:`, event.target.error);
                    reject(event.target.error);
                };
            } catch (error) {
                console.error(`Error in query ${storeName}.${indexName}:`, error);
                reject(error);
            }
        });
    });
};

    // Count items in a store
    this.countItems = function(storeName) {
        return dbReady.then(function() {
            return $q(function(resolve, reject) {
                const transaction = db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const countRequest = store.count();
                
                countRequest.onsuccess = function() {
                    resolve(countRequest.result);
                };
                
                countRequest.onerror = function(event) {
                    console.error('Count error:', event.target.error);
                    reject(event.target.error);
                };
            });
        });
    };

    // Get paginated items with filtering
    this.getPaginatedItems = function(storeName, options, filterFn) {
        const page = options?.page || 1;
        const pageSize = options?.pageSize || 10;
        const indexName = options?.indexName;
        const direction = options?.direction || 'next';
        const range = options?.range;
        
        // Default filter accepts all records
        filterFn = filterFn || function() { return true; };
        
        return dbReady.then(function() {
            return $q(function(resolve, reject) {
                try {
                    const transaction = db.transaction([storeName], 'readonly');
                    const store = transaction.objectStore(storeName);
                    const index = indexName ? store.index(indexName) : store;
                    
                    const results = [];
                    let counter = 0;
                    let filtered = 0;
                    const skip = (page - 1) * pageSize;
                    
                    // First count total for pagination info
                    const countRequest = store.count();
                    let totalRecords = 0;
                    
                    countRequest.onsuccess = function(event) {
                        totalRecords = event.target.result;
                        
                        // Open cursor
                        const cursorRequest = index.openCursor(range, direction);
                        
                        cursorRequest.onsuccess = function(event) {
                            const cursor = event.target.result;
                            
                            // No more results or we've collected enough
                            if (!cursor || results.length >= pageSize) {
                                resolve({
                                    data: results,
                                    total: totalRecords,
                                    page: page,
                                    pageSize: pageSize,
                                    totalPages: Math.ceil(totalRecords / pageSize)
                                });
                                return;
                            }
                            
                            // Apply filter function
                            if (filterFn(cursor.value)) {
                                filtered++;
                                
                                // Skip items before the current page
                                if (filtered > skip) {
                                    results.push(cursor.value);
                                }
                            }
                            
                            counter++;
                            cursor.continue();
                        };
                        
                        cursorRequest.onerror = function(event) {
                            console.error('Cursor error:', event.target.error);
                            reject(event.target.error);
                        };
                    };
                    
                    countRequest.onerror = function(event) {
                        console.error('Count error:', event.target.error);
                        reject(event.target.error);
                    };
                } catch (error) {
                    console.error('Failed to get paginated items from ' + storeName + ':', error);
                    reject(error);
                }
            });
        });
    };

    // Add or update this method for advanced filtering with pagination
    this.getFilteredItems = function(storeName, options) {
        const page = options?.page || 1;
        const pageSize = options?.pageSize || 8;
        const filters = options?.filters || {};
        const sortBy = options?.sortBy;
        const direction = options?.direction || 'next';
        
        return dbReady.then(() => {
            return $q((resolve, reject) => {
                try {
                    const transaction = db.transaction([storeName], 'readonly');
                    const store = transaction.objectStore(storeName);
                    
                    // Get total count for pagination info
                    const countRequest = store.count();
                    let filteredItems = [];
                    let processedItems = 0;
                    let skippedItems = 0;
                    let currentPageItems = [];
                    
                    countRequest.onsuccess = () => {
                        const totalItems = countRequest.result;
                        
                        // Determine which index to use for sorting
                        let source = store;
                        if (sortBy) {
                            try {
                                source = store.index(sortBy);
                            } catch (e) {
                                console.warn(`Index ${sortBy} not found, using default order`);
                            }
                        }
                        
                        // Open cursor
                        const cursorRequest = source.openCursor(null, direction);
                        
                        cursorRequest.onsuccess = (event) => {
                            const cursor = event.target.result;
                            
                            if (!cursor) {
                                // No more results, return what we have
                                const totalPages = Math.ceil(filteredItems.length / pageSize);
                                
                                resolve({
                                    items: currentPageItems,
                                    currentPage: page,
                                    totalPages: totalPages,
                                    totalItems: filteredItems.length,
                                    rawTotalItems: totalItems
                                });
                                return;
                            }
                            
                            const item = cursor.value;
                            let passesFilters = true;
                            
                            // Apply filters
                            Object.keys(filters).forEach(key => {
                                const filterValue = filters[key];
                                
                                // Skip empty filters
                                if (!filterValue || filterValue === '') {
                                    return;
                                }
                                
                                // Special handling for range filters (min/max)
                                if (key === 'minPrice' && item.price_per_day < parseFloat(filterValue)) {
                                    passesFilters = false;
                                    return;
                                }
                                
                                if (key === 'maxPrice' && item.price_per_day > parseFloat(filterValue)) {
                                    passesFilters = false;
                                    return;
                                }
                                
                                // Standard equality filter
                                if (key !== 'minPrice' && key !== 'maxPrice' && 
                                    item[key] !== undefined && item[key] !== filterValue) {
                                    passesFilters = false;
                                    return;
                                }
                            });
                            
                            // If item passes filters, consider it for our result set
                            if (passesFilters) {
                                filteredItems.push(item);
                                
                                // Check if this item belongs on the current page
                                const itemIndex = filteredItems.length - 1;
                                const startIndex = (page - 1) * pageSize;
                                const endIndex = page * pageSize - 1;
                                
                                if (itemIndex >= startIndex && itemIndex <= endIndex) {
                                    currentPageItems.push(item);
                                    
                                    // If we have enough items for this page, we can stop
                                    if (currentPageItems.length >= pageSize) {
                                        const totalPages = Math.ceil(filteredItems.length / pageSize);
                                        
                                        resolve({
                                            items: currentPageItems,
                                            currentPage: page,
                                            totalPages: totalPages,
                                            totalItems: filteredItems.length,
                                            rawTotalItems: totalItems
                                        });
                                        return;
                                    }
                                }
                            }
                            
                            // Process next item
                            processedItems++;
                            if (processedItems % 100 === 0) {
                                console.log(`Processed ${processedItems} items, found ${filteredItems.length} matching items`);
                            }
                            
                            cursor.continue();
                        };
                        
                        cursorRequest.onerror = (event) => {
                            console.error('Cursor error:', event.target.error);
                            reject(event.target.error);
                        };
                    };
                    
                    countRequest.onerror = (event) => {
                        console.error('Count error:', event.target.error);
                        reject(event.target.error);
                    };
                    
                } catch (error) {
                    console.error('Error in getFilteredItems:', error);
                    reject(error);
                }
            });
        });
    };
}]);
