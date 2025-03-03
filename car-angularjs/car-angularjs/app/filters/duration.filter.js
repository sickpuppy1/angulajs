angular.module('carApp')
.filter(
    'duration', 
    function() {
    return function(startDate, endDate) {
        if (!startDate || !endDate) return '';
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = Math.ceil(((end - start)+1) / (1000 * 60 * 60 * 24));
        
        return days + (days === 1 ? ' day' : ' days');
    };
});