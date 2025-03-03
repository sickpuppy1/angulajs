let db;

const dbReady = new Promise((resolve, reject) => {
    // Increment version number
    const request = indexedDB.open('CarRental', 16);

    request.onupgradeneeded = (event) => {
        db = event.target.result;
        
        // Create stores if they don't exist or delete and recreate if they do
        if (db.objectStoreNames.contains('bookings')) {
            db.deleteObjectStore('bookings');
        }
        
        // Create bookings store with all indices
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

        // Denormalized car indices
        bookingStore.createIndex('car.car_id', 'car.car_id');
        bookingStore.createIndex('car.make', 'car.make');
        bookingStore.createIndex('car.model', 'car.model');
        bookingStore.createIndex('car.year', 'car.year');
        bookingStore.createIndex('car.location', 'car.location');
        bookingStore.createIndex('car.price_per_day', 'car.price_per_day');
        bookingStore.createIndex('car.owner_id', 'car.owner_id');

        // Denormalized user indices
        bookingStore.createIndex('user.user_id', 'user.user_id');
        bookingStore.createIndex('user.name', 'user.name');
        bookingStore.createIndex('user.email', 'user.email');
        bookingStore.createIndex('user.role', 'user.role');

        // Metadata indices
        bookingStore.createIndex('metadata.created_by', 'metadata.created_by');
        bookingStore.createIndex('metadata.status_history', 'metadata.status_history', { multiEntry: true });

        // Create cars store if it doesn't exist
        if (!db.objectStoreNames.contains('cars')) {
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
            carStore.createIndex('owner.user_id', 'owner.user_id');
            carStore.createIndex('owner.name', 'owner.name');
            carStore.createIndex('owner.email', 'owner.email');
            carStore.createIndex('owner.role', 'owner.role');
            
            // Metadata indices
            carStore.createIndex('metadata.created_at', 'metadata.created_at');
            carStore.createIndex('metadata.updated_at', 'metadata.updated_at');
            carStore.createIndex('metadata.status_history', 'metadata.status_history', { multiEntry: true });
        }

        console.log('Database schema updated to version', event.newVersion);
        console.log('All indices created for bookings store');
    };

    request.onsuccess = () => {
        db = request.result;
        console.log('Database opened successfully');
        resolve();
    };

    request.onerror = () => {
        console.error('Database error:', request.error);
        reject(request.error);
    };
});

async function addBooking(booking) {
    try {
        // Fetch related data for denormalization
        const [car, user] = await Promise.all([
            getCar(booking.car_id),
            getUser(booking.user_id)
        ]);

        if (!car || !user) {
            throw new Error('Car or User not found for denormalization');
        }

        // Create denormalized booking object
        const denormalizedBooking = {
            ...booking,
            car: {
                car_id: car.car_id,
                make: car.make,
                model: car.model,
                year: car.year,
                price_per_day: car.price_per_day,
                location: car.location,
                owner_id: car.owner_id,
                images: car.images?.[0] // Store first image for preview
            },
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                role: user.role
            },
            metadata: {
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                status_history: [{
                    status: booking.status,
                    timestamp: new Date().toISOString()
                }]
            }
        };
        console.log('Denormalized booking:', denormalizedBooking);

        return dbReady.then(() => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['bookings'], 'readwrite');
                const store = transaction.objectStore('bookings');

                // Add transaction handlers
                transaction.oncomplete = () => {
                    console.log('Booking stored successfully:', denormalizedBooking.id);
                    resolve(denormalizedBooking);
                };

                transaction.onerror = () => {
                    console.error('Transaction error:', transaction.error);
                    reject(transaction.error);
                };

                // Attempt to store the booking
                try {
                    store.add(denormalizedBooking);
                } catch (error) {
                    console.error('Error in store.add:', error);
                    reject(error);
                }
            });
        });

    } catch (error) {
        console.error('Error in addBooking:', error);
        throw error;
    }
}
function updateBooking(booking) {
    return dbReady.then(() => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['bookings'], 'readwrite');
            const store = transaction.objectStore('bookings');
            
            transaction.oncomplete = () => {
                console.log('Booking updated successfully:', booking.id);
                resolve(booking);
            };

            transaction.onerror = () => {
                console.error('Error updating booking:', transaction.error);
                reject(transaction.error);
            };

            try {
                store.put(booking);
            } catch (error) {
                console.error('Error in store.put:', error);
                reject(error);
            }
        });
    });
}





function getUserByEmail(email) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("users", "readonly");
    const store = transaction.objectStore("users");
    const index = store.index("email");
    const request = index.get(email);

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}
function addUser(user) {
  const transaction = db.transaction("users", "readwrite");
  const store = transaction.objectStore("users");
  store.add(user);
}

function getUser(userId) {
    return dbReady.then(() => {
        return new Promise((resolve, reject) => {
            if (!userId) {
                resolve(null);
                return;
            }

            const transaction = db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const request = store.get(userId);

            request.onsuccess = () => {
                const user = request.result;
                if (user) {
                    resolve(user);
                } else {
                    resolve(null); // Return null instead of rejecting
                }
            };
            request.onerror = () => reject(request.error);
        });
    });
}

async function addCar(car) {
    try {
        // Validate required fields
        if (!car.car_id || !car.owner_id) {
            throw new Error('Invalid car data: missing required fields');
        }

        // Fetch owner data for denormalization
        const owner = await getUser(car.owner_id);
        if (!owner) {
            throw new Error(`Owner not found: ${car.owner_id}`);
        }

        // Create denormalized car object
        const denormalizedCar = {
            ...car,
            owner: {
                user_id: owner.user_id,
                name: owner.name,
                email: owner.email,
                role: owner.role
            },
            metadata: {
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                status_history: [{
                    status: car.status || 'available',
                    timestamp: new Date().toISOString()
                }]
            }
        };

        console.log('Denormalized car:', denormalizedCar);

        return dbReady.then(() => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['cars'], 'readwrite');
                
                transaction.oncomplete = () => {
                    console.log('Car stored successfully:', denormalizedCar.car_id);
                    resolve(denormalizedCar);
                };

                transaction.onerror = () => {
                    console.error('Transaction error:', transaction.error);
                    reject(transaction.error);
                };

                const store = transaction.objectStore('cars');
                
                try {
                    store.add(denormalizedCar);
                } catch (error) {
                    console.error('Error in store.add:', error);
                    reject(error);
                }
            });
        });

    } catch (error) {
        console.error('Error in addCar:', error);
        throw error;
    }
}

function getAllCars() {
  return dbReady.then(() => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("cars", "readonly");
      const store = transaction.objectStore("cars");
      const request = store.getAll();

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  });
}

function getCarsByOwner(ownerId) {
    return dbReady.then(() => {
        return new Promise((resolve, reject) => {
            if (!ownerId) {
                resolve([]);
                return;
            }

            const transaction = db.transaction(['cars'], 'readonly');
            const store = transaction.objectStore('cars');
            const request = store.getAll();

            request.onsuccess = () => {
                const cars = request.result || [];
                const ownerCars = cars.filter(car => car.owner_id === ownerId);
                resolve(ownerCars);
            };
            request.onerror = () => reject(request.error);
        });
    });
}

function getCar(carId) {
    return dbReady.then(() => {
        return new Promise((resolve, reject) => {
            if (!carId) {
                resolve(null);
                return;
            }

            const transaction = db.transaction(['cars'], 'readonly');
            const store = transaction.objectStore('cars');
            const request = store.get(carId);

            request.onsuccess = () => {
                const car = request.result;
                if (car) {
                    resolve(car);
                } else {
                    resolve(null); // Return null instead of rejecting
                }
            };
            request.onerror = () => reject(request.error);
        });
    });
}

// Add this function before the exports section
function getBooking(bookingId) {
    return dbReady.then(() => {
        return new Promise((resolve, reject) => {
            if (!bookingId) {
                resolve(null);
                return;
            }

            const transaction = db.transaction(['bookings'], 'readonly');
            const store = transaction.objectStore('bookings');
            const request = store.get(bookingId);

            request.onsuccess = () => {
                const booking = request.result;
                if (booking) {
                    resolve(booking);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => reject(request.error);
        });
    });
}



function getBookingsByUser(userId) {
    return dbReady.then(() => {
        return new Promise((resolve, reject) => {
            if (!userId) {
                resolve([]);
                return;
            }

            const transaction = db.transaction(['bookings'], 'readonly');
            const store = transaction.objectStore('bookings');
            const request = store.getAll();

            request.onsuccess = () => {
                const bookings = request.result || [];
                const userBookings = bookings.filter(booking => booking.user_id === userId);
                resolve(userBookings);
            };
            request.onerror = () => reject(request.error);
        });
    });
}

function getBookingsByCar(carId) {
  return dbReady.then(() => {
      return new Promise((resolve, reject) => {
          const transaction = db.transaction(['bookings'], 'readonly');
          const store = transaction.objectStore('bookings');
          const index = store.index('car_id');
          const request = index.getAll(carId);
          
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = () => reject(request.error);
      });
  });
}

function getAllBookings() {
    return dbReady.then(() => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['bookings'], 'readonly');
            const store = transaction.objectStore('bookings');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    });
}

function addReview(review) {
  const transaction = db.transaction("reviews", "readwrite");
  const store = transaction.objectStore("reviews");
  store.add(review);
}

function getReview(reviewId) {
  const transaction = db.transaction("reviews", "readonly");
  const store = transaction.objectStore("reviews");
  return store.get(reviewId);
}

function getReviewsByUser(userId) {
  const transaction = db.transaction("reviews", "readonly");
  const store = transaction.objectStore("reviews");
  const index = store.index("user_id");
  return index.getAll(userId);
}

function getReviewsByCar(carId) {
  const transaction = db.transaction("reviews", "readonly");
  const store = transaction.objectStore("reviews");
  const index = store.index("car_id");
  return index.getAll(carId);
}

async function addMessage(message) {
    try {
        // Validate required fields
        if (!message.sender_id || !message.receiver_id || !message.car_id) {
            throw new Error('Missing required fields: sender_id, receiver_id, or car_id');
        }

        // Fetch related data with error handling
        const [sender, receiver, car] = await Promise.all([
            getUser(message.sender_id).then(user => {
                if (!user) throw new Error(`Sender user not found: ${message.sender_id}`);
                return user;
            }),
            getUser(message.receiver_id).then(user => {
                if (!user) throw new Error(`Receiver user not found: ${message.receiver_id}`);
                return user;
            }),
            getCar(message.car_id).then(car => {
                if (!car) throw new Error(`Car not found: ${message.car_id}`);
                return car;
            })
        ]);

        // Create denormalized message object
        const denormalizedMessage = {
            ...message,
            sender: {
                user_id: sender.user_id,
                name: sender.name,
                email: sender.email
            },
            receiver: {
                user_id: receiver.user_id,
                name: receiver.name,
                email: receiver.email
            },
            car: {
                car_id: car.car_id,
                make: car.make,
                model: car.model,
                year: car.year,
                price_per_day: car.price_per_day
            }
        };

        return dbReady.then(() => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['messages'], 'readwrite');
                const store = transaction.objectStore('messages');
                const request = store.add(denormalizedMessage);
                request.onsuccess = () => resolve(message);
                request.onerror = () => reject(request.error);
            });
        });
    } catch (error) {
        console.error('Error creating message:', error);
        throw error;
    }
}

function getMessage(messageId) {
  const transaction = db.transaction("messages", "readonly");
  const store = transaction.objectStore("messages");
  return store.get(messageId);
}

function getMessagesBySender(senderId) {
  const transaction = db.transaction("messages", "readonly");
  const store = transaction.objectStore("messages");
  const index = store.index("sender_id");
  return index.getAll(senderId);
}

function getMessagesByReceiver(receiverId) {
  const transaction = db.transaction("messages", "readonly");
  const store = transaction.objectStore("messages");
  const index = store.index("receiver_id");
  return index.getAll(receiverId);
}

function getMessagesByCarId(carId) {
    return dbReady.then(() => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['messages'], 'readonly');
            const store = transaction.objectStore('messages');
            const index = store.index('car_id');
            const request = index.getAll(carId);

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    });
}

async function getMessagesByCar(carId) {
    return dbReady.then(() => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['messages'], 'readonly');
            const store = transaction.objectStore('messages');
            const index = store.index('car_id');
            const request = index.getAll(carId);
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    });
}

function getAllMessages() {
    return dbReady.then(() => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['messages'], 'readonly');
            const store = transaction.objectStore('messages');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    });
}

function updateUserRole(userId, newRole) {
    return dbReady.then(() => {
        return new Promise((resolve, reject) => {
                const transaction = db.transaction(['users'], 'readwrite');
                const store = transaction.objectStore('users');
            const request = store.get(userId);
                
            request.onsuccess = () => {
                const user = request.result;
                    user.role = newRole;
                    const updateRequest = store.put(user);
                    
                updateRequest.onsuccess = () => resolve();
                    updateRequest.onerror = () => reject(updateRequest.error);
                };
                
            request.onerror = () => reject(request.error);
        });
    });
}

async function addConversation(conversation) {
    try {
        // Validate required fields
        if (!conversation.participants || !conversation.car_id) {
            throw new Error('Missing required fields: participants or car_id');
        }

        // Fetch related data with error handling
        const [participants, car] = await Promise.all([
            Promise.all(conversation.participants.map(async (id) => {
                const user = await getUser(id);
                if (!user) {
                    throw new Error(`User not found: ${id}`);
                }
                return user;
            })),
            getCar(conversation.car_id).then(car => {
                if (!car) {
                    throw new Error(`Car not found: ${conversation.car_id}`);
                }
                return car;
            })
        ]);

        // Create denormalized conversation object
        const denormalizedConversation = {
            ...conversation,
            participants_details: participants.map(user => ({
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                role: user.role
            })),
            car: {
                car_id: car.car_id,
                make: car.make,
                model: car.model,
                year: car.year,
                price_per_day: car.price_per_day,
                location: car.location,
                owner_id: car.owner_id
            },
            metadata: {
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
        };

        return dbReady.then(() => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['conversations'], 'readwrite');
                
                transaction.onerror = () => {
                    reject(transaction.error);
                };

                const store = transaction.objectStore('conversations');
                const request = store.add(denormalizedConversation);
                
                request.onsuccess = () => {
                    console.log('Conversation stored successfully:', denormalizedConversation.conversation_id);
                    resolve(denormalizedConversation);
                };
                
                request.onerror = () => reject(request.error);
            });
        });
    } catch (error) {
        console.error('Error creating conversation:', error);
        throw error;
    }
}

function getConversation(conversationId) {
    return dbReady.then(() => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['conversations'], 'readonly');
            const store = transaction.objectStore('conversations');
            const request = store.get(conversationId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    });
}
function getMessagesByConversation(conversationId) {
    return dbReady.then(() => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['messages'], 'readonly');
            const store = transaction.objectStore('messages');
            const index = store.index('conversation_id');
            const request = index.getAll(conversationId);

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    });
}

function getConversationsByParticipant(userId) {
    return dbReady.then(() => {
        return new Promise((resolve, reject) => {
            if (!userId) {
                resolve([]);
                return;
            }

            const transaction = db.transaction(['conversations'], 'readonly');
            const store = transaction.objectStore('conversations');
            const index = store.index('participants');
            const request = index.getAll(userId);

            request.onsuccess = () => {
                const conversations = request.result || [];
                resolve(conversations);
            };
            request.onerror = () => reject(request.error);
        });
    });
}

async function updateBookingStatus(bookingId, newStatus) {
    return dbReady.then(() => {
        return new Promise(async (resolve, reject) => {
            const transaction = db.transaction(['bookings'], 'readwrite');
            const store = transaction.objectStore('bookings');

            try {
                const booking = await new Promise((res, rej) => {
                    const request = store.get(bookingId);
                    request.onsuccess = () => res(request.result);
                    request.onerror = () => rej(request.error);
                });

                if (!booking) {
                    throw new Error('Booking not found');
                }

                // Update status and metadata
                booking.status = newStatus;
                booking.metadata.updated_at = new Date().toISOString();
                booking.metadata.status_history.push({
                    status: newStatus,
                    timestamp: new Date().toISOString()
                });

                // Store updated booking
                const updateRequest = store.put(booking);
                updateRequest.onsuccess = () => resolve(booking);
                updateRequest.onerror = () => reject(updateRequest.error);

            } catch (error) {
                reject(error);
            }
        });
    });
}

// Add new function before exports
async function getBookingsByOwnerId(ownerId) {
    try {
        const [cars, bookings] = await Promise.all([
            getCarsByOwner(ownerId),
            getAllBookings()
        ]);

        // Filter bookings where car belongs to owner
        const ownerBookings = bookings.filter(booking => 
            cars.some(car => car.car_id === booking.car_id)
        );

        return ownerBookings;
    } catch (error) {
        console.error('Error getting bookings by owner:', error);
        throw error;
    }
}

function getBookingById(bookingId) {
    return dbReady.then(() => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['bookings'], 'readonly');
            const store = transaction.objectStore('bookings');
            const request = store.get(bookingId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    });
}

function getBookingsById(bookingId) {
    return dbReady.then(() => {
        return new Promise((resolve, reject) => {
            if (!bookingId) {
                reject(new Error('Booking ID is required'));
                return;
            }

            const transaction = db.transaction(['bookings'], 'readonly');
            const store = transaction.objectStore('bookings');
            const request = store.get(bookingId);

            request.onsuccess = () => {
                const booking = request.result;
                if (booking) {
                    resolve(booking);
                } else {
                    reject(new Error('Booking not found'));
                }
            };

            request.onerror = () => reject(request.error);
        });
    });
}
function updateCar(car) {
    return dbReady.then(() => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['cars'], 'readwrite');
            const store = transaction.objectStore('cars');
            const request = store.put(car);
            
            request.onsuccess = () => resolve(car);
            request.onerror = () => reject(request.error);
        });
    });
}
function updateBookingStatusByCursor(carId, userId, startDate, endDate, newStatus) {
    return dbReady.then(() => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['bookings'], 'readwrite');
            const store = transaction.objectStore('bookings');
            
            // Use the car_dates index for better performance
            const index = store.index('car_dates');
            const keyRange = IDBKeyRange.only([carId, startDate, endDate]);
            const request = index.openCursor(keyRange);
            
            let found = false;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                
                if (cursor) {
                    const booking = cursor.value;
                    
                    console.log('Found booking:', booking); // Debug log
                    
                    if (booking.user_id === userId) {
                        found = true;
                        
                        // Create updated booking object
                        const updatedBooking = {
                            ...booking,
                            status: newStatus,
                            metadata: {
                                ...booking.metadata,
                                updated_at: new Date().toISOString(),
                                status_history: [
                                    ...(booking.metadata?.status_history || []),
                                    {
                                        status: newStatus,
                                        timestamp: new Date().toISOString()
                                    }
                                ]
                            }
                        };

                        console.log('Updating to:', updatedBooking); // Debug log
                        
                        const updateRequest = cursor.update(updatedBooking);
                        
                        updateRequest.onsuccess = () => {
                            console.log('Successfully updated booking status'); // Debug log
                            resolve(updatedBooking);
                        };
                        
                        updateRequest.onerror = (error) => {
                            console.error('Error updating booking:', error); // Debug log
                            reject(new Error('Failed to update booking status'));
                        };
                    } else {
                        cursor.continue();
                    }
                } else if (!found) {
                    console.error('No matching booking found for:', { carId, userId, startDate, endDate }); // Debug log
                    reject(new Error('No matching booking found'));
                }
            };

            request.onerror = (error) => {
                console.error('Cursor error:', error); // Debug log
                reject(new Error('Failed to open cursor'));
            };

            // Add transaction error handler
            transaction.onerror = (error) => {
                console.error('Transaction error:', error); // Debug log
                reject(new Error('Transaction failed'));
            };
        });
    }).catch(error => {
        console.error('Database operation failed:', error); // Debug log
        throw error;
    });
}

export {
  addUser,
  getUser,
  addCar,
  getCarsByOwner,
  addBooking,
  getBooking,
  getBookingsByUser,
  getBookingsByCar,
  getBookingsByOwnerId, 
  getBookingsById,
  addReview,
  getReview,
  getReviewsByUser,
  getReviewsByCar,
  addMessage,
  getMessage,
  getMessagesBySender,
  getMessagesByReceiver,
  getUserByEmail,
  getAllCars,
  getAllBookings,
  getMessagesByCar,
  getMessagesByCarId,
  getAllMessages,
  updateUserRole,
  addConversation,
  getConversation,
  getConversationsByParticipant,
  getMessagesByConversation,
  getCar,
  updateBookingStatus,
  getBookingById,
  updateBookingStatusByCursor,
  updateCar,
  updateBooking,
};