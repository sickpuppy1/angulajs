angular.module('carApp')
.service('BidService', [
    '$q', 
    'DatabaseService', 
    function($q, DatabaseService) {
    
    this.createBid = function(bidData) {
        const booking = {
            id: `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...bidData,
            status: 'pending',
            payment_status: 'pending',
            metadata: {
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                created_by: bidData.user_id
            }
        };

        return DatabaseService.add('bookings', booking);
    };

    this.getBookedDates = function(carId) {
        return DatabaseService.getAllByIndex('bookings', 'car_id', carId)
            .then(bookings => {
                const bookedDates = new Set();
                
                bookings.filter(booking => 
                    booking.status === 'approved' || booking.status === 'active'
                ).forEach(booking => {
                    const start = new Date(booking.start_date);
                    const end = new Date(booking.end_date);
                    for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
                        bookedDates.add(d.toISOString().split('T')[0]);
                    }
                });

                return Array.from(bookedDates);
            });
    };

    this.checkDateOverlap = function(carId, startDate, endDate) {
        return DatabaseService.getAllByIndex('bookings', 'car_id', carId)
            .then(bookings => {
                const start = new Date(startDate);
                const end = new Date(endDate);
                
                return !bookings.some(booking => {
                    if (booking.status !== 'approved' && booking.status !== 'active') {
                        return false;
                    }
                    
                    const bookingStart = new Date(booking.start_date);
                    const bookingEnd = new Date(booking.end_date);
                    
                    return (start <= bookingEnd && end >= bookingStart);
                });
            });
    };

    this.calculateTotal = function(startDate, endDate, dailyRate) {
        const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
        return days * dailyRate;
    };
}]);