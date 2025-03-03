angular.module('carApp')
.service('CarDatabaseService', [
    '$q', 
    'DatabaseService', 
    function($q, DatabaseService) {
    this.data = [];
    
    this.init = async function() {
        try {
            this.data = await DatabaseService.getAll('cars');
            console.log('Car database initialized with cars:', this.data);
            return this.data;
        } catch (error) {
            console.error('Error initializing car database:', error);
            return $q.reject(error);
        }
    };

    this.getCars = function(filters = {}, sort = 'price-asc', page = 1) {
        let cars = [...this.data];
        
        // Apply filters
        if (filters.location) {
            cars = cars.filter(car => car.location.toLowerCase().includes(filters.location.toLowerCase()));
        }
        if (filters.minPrice) {
            cars = cars.filter(car => car.price_per_day >= parseFloat(filters.minPrice));
        }
        if (filters.maxPrice) {
            cars = cars.filter(car => car.price_per_day <= parseFloat(filters.maxPrice));
        }
        if (filters.make) {
            cars = cars.filter(car => car.make.toLowerCase() === filters.make.toLowerCase());
        }
        if (filters.year) {
            cars = cars.filter(car => car.year === parseInt(filters.year));
        }
        
        // Apply sorting
        switch (sort) {
            case 'price-desc':
                cars.sort((a, b) => b.price_per_day - a.price_per_day);
                break;
            case 'year-asc':
                cars.sort((a, b) => a.year - b.year);
                break;
            case 'year-desc':
                cars.sort((a, b) => b.year - a.year);
                break;
            default: // price-asc
                cars.sort((a, b) => a.price_per_day - b.price_per_day);
        }

        // Apply pagination
        const itemsPerPage = 3;
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        
        return {
            cars: cars.slice(startIndex, endIndex),
            totalPages: Math.ceil(cars.length / itemsPerPage),
            currentPage: page,
            totalCars: cars.length
        };
    };
}]);