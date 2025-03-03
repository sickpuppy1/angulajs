/**
 * @description Analysis Controller
 * Handles the analytics tab of the admin dashboard
 */
angular.module('carApp')
.controller('AnalysisController', [
    'StyleLoaderService',
    'CarService',
    'UserService',
    'BookingService',
    'ToastService', 
    '$timeout',
    function(StyleLoaderService, CarService, UserService, BookingService, ToastService, $timeout) {
        const vm = this;
        
        // Loading states
        vm.loading = {
            stats: false,
            charts: false
        };
        
        // Stats data
        vm.stats = {
            totalCars: 0,
            totalUsers: 0,
            totalBookings: 0,
            totalRevenue: 0
        };
        
        // Chart tracking
        vm.chartsInitialized = false;
        let chartInstances = {
            bookingsChart: null,
            topCarsChart: null
        };
        
        /**
         * @description Initialize the controller
         */
        vm.init = function() {
            // Load component-specific CSS
            StyleLoaderService.loadStylesheet('app/components/admin/tabs/analysis/analysis.css')
                .catch(error => {
                    console.error('Failed to load analysis styles:', error);
                });
            loadStats();
        };
        
        function loadStats() {
            vm.loading.stats = true;
            
            async.parallel({
                cars: function(callback) {
                    CarService.getAllCars()
                        .then(result => callback(null, result))
                        .catch(err => callback(err));
                },
                users: function(callback) {
                    UserService.getAllUsers()
                        .then(users => callback(null, users))
                        .catch(err => callback(err));
                },
                bookings: function(callback) {
                    BookingService.getAllBookings()
                        .then(bookings => callback(null, bookings))
                        .catch(err => callback(err));
                }
            }, function(err, results) {
                if (err) {
                    console.error('Error loading stats:', err);
                    ToastService.error('Failed to load statistics');
                    vm.loading.stats = false;
                    return;
                }

                // Process car stats
                vm.stats.totalCars = results.cars.totalCars || 0;
                
                // Process user stats
                vm.stats.totalUsers = results.users.length;
                
                // Process booking stats
                vm.stats.totalBookings = results.bookings.length;
                vm.bookings = results.bookings;
                
                // Calculate revenue (assuming 10% platform fee)
                const totalAmount = results.bookings
                    .filter(booking => booking.status === 'completed')
                    .reduce((sum, booking) => sum + (booking.total_amount || 0), 0);
                    
                vm.stats.totalRevenue = (totalAmount * 0.1).toFixed(2);
                
                // Initialize charts
                loadCharts();
                
                // Update UI and finish loading
                vm.loading.stats = false;
                $timeout();
            });
        }
        
        function loadCharts() {
            vm.loading.charts = true;
            
            if (!vm.bookings || vm.bookings.length === 0) {
                vm.loading.charts = false;
                return;
            }
            
            $timeout(function() {
                try {
                    initializeBookingsChart();
                    initializeTopCarsChart();
                    vm.chartsInitialized = true;
                } catch (error) {
                    console.error('Error initializing charts:', error);
                    ToastService.error('Failed to initialize charts');
                } finally {
                    vm.loading.charts = false;
                }
            });
        }
        
        function initializeBookingsChart() {
            const bookingsCtx = document.getElementById('bookingsChart');
            if (!bookingsCtx) return;
            
            // Destroy existing chart if it exists
            if (chartInstances.bookingsChart) {
                chartInstances.bookingsChart.destroy();
            }
            
            const bookingsByMonth = getBookingsByMonth(vm.bookings);
            chartInstances.bookingsChart = new Chart(bookingsCtx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: bookingsByMonth.labels,
                    datasets: [{
                        label: 'Bookings',
                        data: bookingsByMonth.data,
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0 }
                        }
                    }
                }
            });
        }
        
        function initializeTopCarsChart() {
            const carsCtx = document.getElementById('topCarsChart');
            if (!carsCtx) return;
            
            // Destroy existing chart if it exists
            if (chartInstances.topCarsChart) {
                chartInstances.topCarsChart.destroy();
            }
            
            const topCars = getTopCars(vm.bookings);
            chartInstances.topCarsChart = new Chart(carsCtx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: topCars.labels,
                    datasets: [{
                        label: 'Bookings',
                        data: topCars.data,
                        backgroundColor: [
                            'rgba(255, 99, 132, 0.5)',
                            'rgba(54, 162, 235, 0.5)',
                            'rgba(255, 206, 86, 0.5)',
                            'rgba(75, 192, 192, 0.5)',
                            'rgba(153, 102, 255, 0.5)'
                        ],
                        borderColor: [
                            'rgba(255, 99, 132, 1)',
                            'rgba(54, 162, 235, 1)',
                            'rgba(255, 206, 86, 1)',
                            'rgba(75, 192, 192, 1)',
                            'rgba(153, 102, 255, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0 }
                        }
                    }
                }
            });
        }
        
        function getBookingsByMonth(bookings) {
            const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const data = Array(12).fill(0);
            
            bookings.forEach(booking => {
                const date = new Date(booking.created_at);
                data[date.getMonth()]++;
            });
            
            return { labels, data };
        }
        
        function getTopCars(bookings) {
            const carBookings = {};
            
            // Count bookings by car
            bookings.forEach(booking => {
                if (!booking.car_details) return;
                
                const carName = `${booking.car_details.make} ${booking.car_details.model}`;
                if (!carBookings[carName]) {
                    carBookings[carName] = 0;
                }
                carBookings[carName]++;
            });
            
            // Sort and get top 5
            const sortedCars = Object.entries(carBookings)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
                
            return {
                labels: sortedCars.map(car => car[0]),
                data: sortedCars.map(car => car[1])
            };
        }
    }
]);