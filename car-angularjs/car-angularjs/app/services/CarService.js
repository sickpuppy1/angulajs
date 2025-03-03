angular.module('carApp')
.service('CarService', [
    '$q', 
    'DatabaseService', 
    'CarDatabaseService', 
function($q, DatabaseService, CarDatabaseService) {
    
    // Initialize database
    CarDatabaseService.init().catch(error => {
        console.error('Error initializing car database:', error);
    });

    // Update the getAllCars method to use the optimized filtering
    this.getAllCars = function(filters, sortOrder, page = 1) {
        return $q((resolve, reject) => {
            let sortBy, direction;

            // Determine sorting parameters
            if (sortOrder === 'price-asc') {
                sortBy = 'price_per_day';
                direction = 'next';
            } else if (sortOrder === 'price-desc') {
                sortBy = 'price_per_day';
                direction = 'prev';
            } else if (sortOrder === 'year-desc') {
                sortBy = 'year';
                direction = 'prev';
            } else if (sortOrder === 'year-asc') {
                sortBy = 'year';
                direction = 'next';
            }

            // Filter only for available cars by default if no status is specified
            const finalFilters = { ...filters };
            if (!finalFilters.status) {
                finalFilters.status = 'available';
            }

            // Get cars with filtering and pagination
            DatabaseService.getFilteredItems('cars', {
                page: page,
                pageSize: 8, // Use your desired page size
                filters: finalFilters,
                sortBy: sortBy,
                direction: direction
            })
            .then(function(result) {
                resolve({
                    cars: result.items,
                    currentPage: result.currentPage,
                    totalPages: result.totalPages,
                    totalCars: result.totalItems
                });
            })
            .catch(function(error) {
                reject(error);
            });
        });
    };

    // Add getCarById method with owner details
    this.getCarById = function(carId) {
        return $q.when(DatabaseService.get('cars', carId))
            .then(function(car) {
                if (!car) {
                    return $q.reject('Car not found');
                }
                // Ensure owner_id is present
                if (!car.owner_id) {
                    return $q.reject('Car owner information not found');
                }
                return car;
            })
            .catch(function(error) {
                console.error('Error fetching car:', error);
                return $q.reject('Failed to fetch car details: ' + error);
            });
    };

    this.addCar = function(carData) {
        const userSession = JSON.parse(sessionStorage.getItem('userSession'));
        if (!userSession) {
            return $q.reject('User not authenticated');
        }

        // Add car with owner information
        const newCar = {
            ...carData,
            car_id: 'car_' + Date.now(),
            owner_id: userSession.user_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            metadata: {
                created_by: userSession.user_id,
                created_at: new Date().toISOString()
            }
        };
        
        return DatabaseService.add('cars', newCar);
    };


    this.getAvailableMakes = function() {
        return $q.when([...new Set(CarDatabaseService.data.map(car => car.make))].sort());
    };

    this.getAvailableYears = function() {
        return $q.when([...new Set(CarDatabaseService.data.map(car => car.year))].sort((a, b) => b - a));
    };

    this.placeBid = function(bidData) {
        return DatabaseService.add('bookings', {
            ...bidData,
            booking_id: 'booking_' + new Date().getTime(),
            price_per_mile: bidData.car.price_per_mile || 0,
            included_miles: 100
        });
    };

    // Add method to get car with owner details
    this.getCarWithOwner = function(carId) {
        return this.getCarById(carId)
            .then(function(car) {
                return DatabaseService.get('users', car.owner_id)
                    .then(function(owner) {
                        if (!owner) {
                            return $q.reject('Car owner not found');
                        }
                        return {
                            ...car,
                            owner: {
                            user_id: owner.user_id,
                            name: owner.name,
                            email: owner.email,
                            phone: owner.phone
                            }
                        };
                    });
            });
    };

    // Add this method to CarService
    this.getCarsByOwner = function(ownerId) {
        if (!ownerId) {
            return $q.reject('Owner ID is required');
        }
        
        return DatabaseService.query('cars', 'owner_id', ownerId)
            .then(function(cars) {
                if (!cars || !Array.isArray(cars)) {
                    return [];
                }
                return cars;
            })
            .catch(function(error) {
                console.error('Error fetching cars by owner:', error);
                return $q.reject('Failed to get cars: ' + error);
            });
    };

    // Update getPendingListings to exclude unlisted-pending cars
    this.getPendingListings = function() {
        return $q.all([
            DatabaseService.getAll('cars'),
            DatabaseService.getAll('users')
        ])
        .then(function([cars, users]) {
            if (!cars || !Array.isArray(cars)) {
                return [];
            }
            
            // Create a map of blocked users for quick lookup
            const blockedOwners = new Map();
            if (users && Array.isArray(users)) {
                users.forEach(user => {
                    if (user.blocked || (user.metadata && user.metadata.status === 'blocked')) {
                        blockedOwners.set(user.user_id, true);
                    }
                });
            }
            
            // Filter to get only pending or newly added cars from non-blocked owners
            // Also exclude unlisted-pending cars
            return cars.filter(car => 
                (car.status === 'pending' || car.status === 'new') && 
                !blockedOwners.has(car.owner_id) &&
                car.status !== 'unlisted-pending'
            );
        });
    };

    // Update the updateCarStatus method to handle metadata
    this.updateCarStatus = function(carId, status, metadata) {
        if (!carId || !status) {
            return $q.reject('Car ID and status are required');
        }
        
        return DatabaseService.get('cars', carId)
            .then(function(car) {
                if (!car) {
                    return $q.reject('Car not found');
                }
                
                car.status = status;
                car.updated_at = new Date().toISOString();
                
                // Update metadata if provided
                if (metadata) {
                    car.metadata = { ...car.metadata, ...metadata };
                }
                
                return DatabaseService.update('cars', car);
            })
            .catch(function(error) {
                console.error('Error updating car status:', error);
                return $q.reject('Failed to update car: ' + error);
            });
    };

    // Add method to get cars by owner and status
    this.getCarsByOwnerAndStatus = function(ownerId, status) {
        return this.getCarsByOwner(ownerId)
            .then(function(cars) {
                if (status) {
                    return cars.filter(car => car.status === status);
                }
                return cars;
            });
    };
}]);